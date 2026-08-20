const bcrypt = require("bcrypt");
const { generateTempPassword } = require("../../utils/auth/generateTempPassword");
const {
  assignPlanToOrganization,
  markInvoicePaid,
} = require("../subscription/subscriptionBilling");
const { sendBrokerWelcomeEmail } = require("../emails/brokerWelcomeEmail");
const { commonLogs } = require("../logger/contextLogger");
const {
  notifyPlatform,
  PLATFORM_NOTIFICATION_EVENTS,
} = require("../notifications/platformNotifications");

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
 * Sends a "set password" welcome email to the loan-ai user's email.
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
  } = payload;

  let brokerOrg;
  let brokerAdmin;
  let invoice;
  let isExistingUser = false;

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

    // Generate a dummy password hash (user will set real password via welcome email link)
    const dummyPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(dummyPassword, 10);

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
      addOnCodes: payload.addOnCodes || [],
      trialDays: 0,
      notes: "Provisioned via Loan AI subscription purchase",
      generateInvoice: true,
    });

    if (createdInvoice) {
      invoice = await markInvoicePaid(prisma, createdInvoice.id);
    }

    // Send welcome email with "set password" link (idempotent via email service)
    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: packageId },
      select: { name: true },
    });
    const packageName = pkg?.name || "Selected Plan";

    await sendBrokerWelcomeEmail({
      adminFirstName: firstName,
      adminEmail: loginEmail,
      organizationName: brokerOrg.name,
      packageName,
      prisma,
    });

    try {
      await notifyPlatform(prisma, io, {
        eventType: PLATFORM_NOTIFICATION_EVENTS.BROKER_REGISTERED,
        category: "ORGANIZATION",
        subject: "New broker via Loan AI subscription",
        body: `${organizationName} subscribed via Loan AI (${loginEmail}).`,
        metadata: {
          organizationId: brokerOrg.id,
          organizationName: brokerOrg.name,
          adminEmail: loginEmail,
          source: "LOAN_AI_PURCHASE",
          packageId,
          billingCycle,
          addOnCodes: payload.addOnCodes || [],
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

module.exports = { provisionBrokerFromLoanAi };
