const bcrypt = require("bcrypt");
const { generateTempPassword } = require("../../utils/auth/generateTempPassword");
const {
  assignPlanToOrganization,
  markInvoicePaid,
} = require("../subscription/subscriptionBilling");
const { sendBrokerWelcomeEmail } = require("../emails/brokerWelcomeEmail");
const { sendBrokerCredentialsEmail } = require("../emails/brokerCredentialsEmail");
const { commonLogs } = require("../logger/contextLogger");
const {
  notifyPlatform,
  PLATFORM_NOTIFICATION_EVENTS,
} = require("../notifications/platformNotifications");

async function ensureBrokerAdminRole(prisma, userId) {
  const role = await prisma.role.findFirst({ where: { name: "BROKER_ADMIN" } });
  if (!role) throw new Error("BROKER_ADMIN role missing");
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId: role.id },
  });
  if (!existing) {
    await prisma.userRole.create({
      data: { userId, roleId: role.id },
    });
  }
}

/**
 * Ensures the Loan AI buyer has a broker dashboard login on the org.
 * Used when payment fulfillment activates an org that was missing a UserAccount
 * (e.g. renew path / partial provision). New accounts get credentials email;
 * existing accounts get a set-password welcome email (best-effort).
 */
async function ensureBrokerAdminAccess(prisma, {
  organizationId,
  loanAiUser,
  firstName,
  lastName,
  packageName = "Selected Plan",
  sendWelcome = true,
  welcomeIdempotencyKey,
} = {}) {
  if (!organizationId || !loanAiUser?.email) {
    throw Object.assign(new Error("organizationId and loanAiUser are required"), {
      statusCode: 400,
    });
  }

  const loginEmail = String(loanAiUser.email).trim().toLowerCase();
  const resolvedFirstName =
    String(firstName || loanAiUser.firstName || "").trim() || "there";
  const resolvedLastName =
    String(lastName || loanAiUser.lastName || "").trim() || "Broker";

  let brokerAdmin = await prisma.userAccount.findFirst({
    where: { email: { equals: loginEmail, mode: "insensitive" } },
  });

  let created = false;
  let temporaryPassword = null;
  if (!brokerAdmin) {
    temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    brokerAdmin = await prisma.userAccount.create({
      data: {
        organizationId,
        email: loginEmail,
        passwordHash,
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        status: "ACTIVE",
      },
    });
    created = true;
  } else if (brokerAdmin.organizationId !== organizationId) {
    brokerAdmin = await prisma.userAccount.update({
      where: { id: brokerAdmin.id },
      data: {
        organizationId,
        firstName: brokerAdmin.firstName || resolvedFirstName,
        lastName: brokerAdmin.lastName || resolvedLastName,
        status: "ACTIVE",
      },
    });
  }

  await ensureBrokerAdminRole(prisma, brokerAdmin.id);

  if (loanAiUser.brokerOrganizationId !== organizationId) {
    await prisma.loanAiUser.update({
      where: { id: loanAiUser.id },
      data: {
        brokerOrganizationId: organizationId,
        firstName: loanAiUser.firstName || resolvedFirstName,
        lastName: loanAiUser.lastName || resolvedLastName,
      },
    });
  }

  let welcomeSent = false;
  let credentialsSent = false;
  if (sendWelcome) {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      const organizationName = org?.name || "your brokerage";

      if (created && temporaryPassword) {
        await sendBrokerCredentialsEmail({
          adminFirstName: resolvedFirstName,
          adminEmail: loginEmail,
          temporaryPassword,
          organizationName,
          packageName,
          prisma,
          idempotencyKey:
            welcomeIdempotencyKey ||
            `broker-credentials:${loginEmail}`,
        });
        credentialsSent = true;
      } else {
        await sendBrokerWelcomeEmail({
          firstName: resolvedFirstName,
          email: loginEmail,
          organizationName,
          packageName,
          prisma,
          idempotencyKey: welcomeIdempotencyKey,
        });
        welcomeSent = true;
      }
    } catch (mailErr) {
      commonLogs.error(
        "Broker login email failed after ensure admin access",
        mailErr,
      );
    }
  }

  return {
    userId: brokerAdmin.id,
    email: loginEmail,
    created,
    welcomeSent,
    credentialsSent,
  };
}

async function rollbackProvisionedBroker(prisma, { organizationId, loanAiUserId }) {
  try {
    const sub = await prisma.organizationSubscription.findFirst({
      where: { organizationId },
      select: { id: true },
    });

    if (sub) {
      await prisma.subscriptionInvoice.deleteMany({
        where: { organizationSubscriptionId: sub.id },
      });
      await prisma.subscriptionUsage.deleteMany({
        where: { organizationSubscriptionId: sub.id },
      });
      await prisma.organizationSubscription.delete({ where: { id: sub.id } });
    }

    await prisma.userRole.deleteMany({
      where: { user: { organizationId } },
    });
    await prisma.userAccount.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });

    await prisma.loanAiUser.update({
      where: { id: loanAiUserId },
      data: { brokerOrganizationId: null },
    });
  } catch (rollbackErr) {
    commonLogs.error("Failed to rollback broker provision after email error", rollbackErr);
  }
}

/**
 * Provisions a broker org + admin from a Loan AI subscription purchase.
 * New accounts receive login email + temporary password; existing accounts get a set-password link.
 */
async function provisionBrokerFromLoanAi(prisma, io, loanAiUser, payload) {
  const loginEmail = loanAiUser.email.trim().toLowerCase();

  // Check if user already has an active broker subscription
  if (loanAiUser.brokerOrganizationId) {
    const existingSub = await prisma.organizationSubscription.findFirst({
      where: {
        organizationId: loanAiUser.brokerOrganizationId,
        status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
      },
    });

    if (existingSub) {
      throw Object.assign(new Error("You already have an active broker subscription"), {
        statusCode: 409,
      });
    }
  }

  // Check if a broker user already exists for this email
  const existingBrokerUser = await prisma.userAccount.findFirst({
    where: { email: { equals: loginEmail, mode: "insensitive" } },
    include: { organization: true, roles: { include: { role: true } } },
  });

  const {
    packageId,
    billingCycle,
    organizationName,
    organizationEmail,
    organizationPhone,
    firstName,
    lastName,
    trialDays = 0,
    generateInvoice = true,
    notes = "Provisioned via Loan AI subscription purchase",
    notificationSource = "LOAN_AI_PURCHASE",
  } = payload;

  const isFreeTrial = Number(trialDays) > 0;

  let brokerOrg;
  let brokerAdmin;
  let invoice;
  let isExistingUser = false;
  let temporaryPassword = null;

  if (existingBrokerUser) {
    // Existing broker user found - link to existing or new organization
    isExistingUser = true;

    if (loanAiUser.brokerOrganizationId && existingBrokerUser.organizationId === loanAiUser.brokerOrganizationId) {
      // User already has this org linked, use existing org
      brokerOrg = await prisma.organization.findUnique({
        where: { id: loanAiUser.brokerOrganizationId },
      });
      if (!brokerOrg) {
        throw Object.assign(new Error("Linked broker organization not found"), { statusCode: 404 });
      }
      brokerAdmin = existingBrokerUser;

      // Ensure user has BROKER_ADMIN role
      const hasAdminRole = brokerAdmin.roles.some((r) => r.role.name === "BROKER_ADMIN");
      if (!hasAdminRole) {
        const role = await prisma.role.findFirst({ where: { name: "BROKER_ADMIN" } });
        if (role) {
          await prisma.userRole.create({
            data: { userId: brokerAdmin.id, roleId: role.id },
          });
        }
      }
    } else {
      // Check for organization conflicts
      const orgConflict = await prisma.organization.findFirst({
        where: {
          OR: [
            { name: organizationName },
            { email: organizationEmail },
            { phone: String(organizationPhone) },
          ],
        },
      });

      if (orgConflict) {
        throw Object.assign(new Error("Organization with these details already exists"), {
          statusCode: 409,
        });
      }

      // Create new organization for the existing user
      await prisma.$transaction(async (tx) => {
        brokerOrg = await tx.organization.create({
          data: {
            name: organizationName,
            email: organizationEmail,
            phone: String(organizationPhone),
            type: "BROKER",
            status: "ACTIVE",
          },
        });

        // Update existing user to link to new org and ensure BROKER_ADMIN role
        brokerAdmin = await tx.userAccount.update({
          where: { id: existingBrokerUser.id },
          data: {
            organizationId: brokerOrg.id,
            firstName,
            lastName,
            status: "ACTIVE",
          },
          include: { roles: { include: { role: true } } },
        });

        const hasAdminRole = brokerAdmin.roles.some((r) => r.role.name === "BROKER_ADMIN");
        if (!hasAdminRole) {
          const role = await tx.role.findFirst({ where: { name: "BROKER_ADMIN" } });
          if (role) {
            await tx.userRole.create({
              data: { userId: brokerAdmin.id, roleId: role.id },
            });
          }
        }

        // Update Loan AI user to link to new broker org
        await tx.loanAiUser.update({
          where: { id: loanAiUser.id },
          data: {
            brokerOrganizationId: brokerOrg.id,
            firstName,
            lastName,
          },
        });
      });
    }
  } else {
    // No existing broker user - create new organization and user
    const orgConflict = await prisma.organization.findFirst({
      where: {
        OR: [
          { name: organizationName },
          { email: organizationEmail },
          { phone: String(organizationPhone) },
        ],
      },
    });

    if (orgConflict) {
      throw Object.assign(new Error("Organization with these details already exists"), {
        statusCode: 409,
      });
    }

    temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await prisma.$transaction(async (tx) => {
      brokerOrg = await tx.organization.create({
        data: {
          name: organizationName,
          email: organizationEmail,
          phone: String(organizationPhone),
          type: "BROKER",
          status: "ACTIVE",
        },
      });

      brokerAdmin = await tx.userAccount.create({
        data: {
          organizationId: brokerOrg.id,
          email: loginEmail,
          passwordHash,
          firstName,
          lastName,
          status: "ACTIVE",
        },
      });

      const role = await tx.role.findFirst({ where: { name: "BROKER_ADMIN" } });
      if (!role) throw new Error("BROKER_ADMIN role missing");

      await tx.userRole.create({
        data: { userId: brokerAdmin.id, roleId: role.id },
      });

      await tx.loanAiUser.update({
        where: { id: loanAiUser.id },
        data: {
          brokerOrganizationId: brokerOrg.id,
          firstName,
          lastName,
        },
      });
    });
  }

  try {
    const { subscription, invoice: createdInvoice } = await assignPlanToOrganization(prisma, {
      organizationId: brokerOrg.id,
      packageId,
      billingCycle,
      // Free trial is plan-only — add-ons apply at paid conversion.
      addOnCodes: isFreeTrial ? [] : payload.addOnCodes || [],
      trialDays: Number(trialDays) || 0,
      notes,
      generateInvoice: isFreeTrial ? false : generateInvoice,
      loanAiUserId: loanAiUser.id,
    });

    if (createdInvoice && !isFreeTrial) {
      invoice = await markInvoicePaid(prisma, createdInvoice.id);
    }

    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: packageId },
      select: { name: true },
    });
    const packageName = isFreeTrial
      ? pkg?.name || "Selected Plan"
      : pkg?.name || "Selected Plan";

    // New accounts get email + temporary password; existing accounts get set-password link.
    if (!isExistingUser && temporaryPassword) {
      await sendBrokerCredentialsEmail({
        adminFirstName: firstName,
        adminEmail: loginEmail,
        temporaryPassword,
        organizationName: brokerOrg.name,
        packageName,
        prisma,
        trialDays: Number(trialDays) || 0,
        trialEndsAt: subscription?.trialEndsAt || null,
        idempotencyKey: isFreeTrial
          ? `broker-credentials-trial:${loginEmail}`
          : `broker-credentials:${loginEmail}`,
      });
    } else {
      await sendBrokerWelcomeEmail({
        firstName,
        email: loginEmail,
        organizationName: brokerOrg.name,
        packageName,
        prisma,
        idempotencyKey: isFreeTrial
          ? `broker-welcome-trial:${loginEmail}`
          : `broker-welcome:${loginEmail}`,
      });
    }

    try {
      await notifyPlatform(prisma, io, {
        eventType: PLATFORM_NOTIFICATION_EVENTS.BROKER_REGISTERED,
        category: "ORGANIZATION",
        subject: isFreeTrial
          ? notificationSource === "CLM_GHL_SOFT_TRIAL"
            ? "New broker via CLM GHL soft trial"
            : "New broker via Loan AI free trial"
          : "New broker via Loan AI subscription",
        body: isFreeTrial
          ? notificationSource === "CLM_GHL_SOFT_TRIAL"
            ? `${organizationName} started a 90-day Loan Automation trial via CLM GHL (${loginEmail}).`
            : `${organizationName} started a free trial via Loan AI (${loginEmail}).`
          : `${organizationName} subscribed via Loan AI (${loginEmail}).`,
        metadata: {
          organizationId: brokerOrg.id,
          organizationName: brokerOrg.name,
          adminEmail: loginEmail,
          source: notificationSource,
          packageId,
          billingCycle,
          trialDays: Number(trialDays) || 0,
          addOnCodes: isFreeTrial ? [] : payload.addOnCodes || [],
          isExistingUser,
        },
      });
    } catch (notifErr) {
      commonLogs.warn("Loan AI purchase platform notification failed", {
        error: notifErr.message,
      });
    }

    return {
      organizationId: brokerOrg.id,
      userId: brokerAdmin.id,
      subscriptionId: subscription?.id,
      invoiceId: invoice?.id,
      credentialsSentTo: loginEmail,
      isExistingUser,
      trialEndsAt: subscription?.trialEndsAt || null,
      status: subscription?.status || null,
    };
  } catch (err) {
    // Only rollback if we created a new org (not if we linked existing user)
    if (!isExistingUser || (existingBrokerUser && !loanAiUser.brokerOrganizationId)) {
      await rollbackProvisionedBroker(prisma, {
        organizationId: brokerOrg.id,
        loanAiUserId: loanAiUser.id,
      });
    }
    throw err;
  }
}

module.exports = {
  provisionBrokerFromLoanAi,
  ensureBrokerAdminAccess,
};
