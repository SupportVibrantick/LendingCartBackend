const bcrypt = require("bcrypt");
const { generateTempPassword } = require("../utils/generateTempPassword");
const {
  assignPlanToOrganization,
  markInvoicePaid,
} = require("./subscriptionBilling");
const { sendBrokerCredentialsEmail } = require("./brokerCredentialsEmail");
const { commonLogs } = require("./logger/contextLogger");
const {
  notifyPlatform,
  PLATFORM_NOTIFICATION_EVENTS,
} = require("./platformNotifications");

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
 * Credentials email goes to the loan-ai user's email (broker login email).
 */
async function provisionBrokerFromLoanAi(prisma, io, loanAiUser, payload) {
  const loginEmail = loanAiUser.email.trim().toLowerCase();

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

  const brokerUserExists = await prisma.userAccount.findFirst({
    where: { email: { equals: loginEmail, mode: "insensitive" } },
  });

  if (brokerUserExists) {
    throw Object.assign(
      new Error("A broker account already exists for this email. Sign in to the broker dashboard."),
      { statusCode: 409 },
    );
  }

  const {
    packageId,
    billingCycle,
    organizationName,
    organizationEmail,
    organizationPhone,
    firstName,
    lastName,
  } = payload;

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

  const temporaryPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  let brokerOrg;
  let brokerAdmin;
  let invoice;

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

  try {
    const { subscription, invoice: createdInvoice } = await assignPlanToOrganization(prisma, {
      organizationId: brokerOrg.id,
      packageId,
      billingCycle,
      trialDays: 0,
      notes: "Provisioned via Loan AI subscription purchase",
      generateInvoice: true,
    });

    if (createdInvoice) {
      invoice = await markInvoicePaid(prisma, createdInvoice.id);
    }

    await sendBrokerCredentialsEmail({
      adminFirstName: firstName,
      adminEmail: loginEmail,
      temporaryPassword,
      organizationName,
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
          organizationName,
          adminEmail: loginEmail,
          source: "LOAN_AI_PURCHASE",
          packageId,
          billingCycle,
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
    };
  } catch (err) {
    await rollbackProvisionedBroker(prisma, {
      organizationId: brokerOrg.id,
      loanAiUserId: loanAiUser.id,
    });
    throw err;
  }
}

module.exports = { provisionBrokerFromLoanAi };
