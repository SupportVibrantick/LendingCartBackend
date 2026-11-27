const crypto = require("crypto");
const bcrypt = require("bcrypt");

/**
 * Admin-assigned / seeded broker orgs often have no LoanAiUser.
 * Checkout rows require loanAiUserId, so create or link a billing profile.
 */
async function ensureLoanAiBillingUser(
  prisma,
  { organizationId, subscriptionId, email, firstName, lastName },
) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalizedEmail) {
    throw Object.assign(new Error("No billing email on file"), {
      statusCode: 400,
      code: "MISSING_BILLING_EMAIL",
    });
  }

  let user =
    (await prisma.loanAiUser.findFirst({
      where: { brokerOrganizationId: organizationId },
    })) ||
    (await prisma.loanAiUser.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    }));

  if (
    user?.brokerOrganizationId &&
    user.brokerOrganizationId !== organizationId
  ) {
    // Email already tied to another brokerage — create an org-scoped billing profile.
    const local = normalizedEmail.split("@")[0] || "broker";
    const domain = normalizedEmail.split("@")[1] || "lendingcart.local";
    const scopedEmail = `${local}+org-${String(organizationId).slice(0, 8)}@${domain}`;
    user = await prisma.loanAiUser.findFirst({
      where: { email: { equals: scopedEmail, mode: "insensitive" } },
    });
    if (!user) {
      const passwordHash = await bcrypt.hash(
        crypto.randomBytes(24).toString("hex"),
        12,
      );
      user = await prisma.loanAiUser.create({
        data: {
          email: scopedEmail,
          passwordHash,
          firstName: firstName || null,
          lastName: lastName || null,
          brokerOrganizationId: organizationId,
        },
      });
    } else if (!user.brokerOrganizationId) {
      user = await prisma.loanAiUser.update({
        where: { id: user.id },
        data: { brokerOrganizationId: organizationId },
      });
    }
  } else if (!user) {
    const passwordHash = await bcrypt.hash(
      crypto.randomBytes(24).toString("hex"),
      12,
    );
    user = await prisma.loanAiUser.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
        brokerOrganizationId: organizationId,
      },
    });
  } else if (!user.brokerOrganizationId) {
    user = await prisma.loanAiUser.update({
      where: { id: user.id },
      data: {
        brokerOrganizationId: organizationId,
        firstName: user.firstName || firstName || null,
        lastName: user.lastName || lastName || null,
      },
    });
  }

  if (subscriptionId && user?.id) {
    await prisma.organizationSubscription.updateMany({
      where: { id: subscriptionId, loanAiUserId: null },
      data: { loanAiUserId: user.id },
    });
  }

  return user;
}

module.exports = {
  ensureLoanAiBillingUser,
};
