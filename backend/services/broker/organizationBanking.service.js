/**
 * Principal broker / firm banking profile used as the ACH debit source
 * when paying loan-officer and co-broker commissions.
 */

const { randomUUID } = require("crypto");
const {
  formatBankingForAdmin,
  requireBankingFromFields,
  bankingFingerprint,
} = require("./userBankingProfile.service");

function formatOrgBanking(profile) {
  if (!profile) return null;
  return {
    ...formatBankingForAdmin(profile),
    hasStripeCustomer: Boolean(profile.stripeCustomerId),
    hasPaymentMethod: Boolean(profile.stripePaymentMethodId),
    achDebitAuthorizedAt: profile.achDebitAuthorizedAt || null,
    accountLast4: maskLast4(profile.accountNumber),
  };
}

function maskLast4(accountNumber) {
  const digits = String(accountNumber || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(-4);
}

async function getOrganizationBanking(db, organizationId) {
  return db.organizationBankingProfile.findUnique({
    where: { organizationId },
  });
}

/**
 * @param {import("@prisma/client").PrismaClient | import("@prisma/client").Prisma.TransactionClient} db
 */
async function upsertOrganizationBanking(
  db,
  {
    organizationId,
    banking,
    authorizedByUserId = null,
    authorizeAchDebit = true,
  },
) {
  const existing = await getOrganizationBanking(db, organizationId);
  const nextFingerprint = bankingFingerprint(banking);
  const prevFingerprint = existing ? bankingFingerprint(existing) : null;
  const clearStripe = Boolean(existing && prevFingerprint !== nextFingerprint);

  const data = {
    accountType: banking.accountType,
    partyName: banking.partyName,
    partyAddress: banking.partyAddress,
    partyTel: banking.partyTel,
    partyEmail: banking.partyEmail,
    bankName: banking.bankName,
    bankTel: banking.bankTel,
    accountName: banking.accountName,
    accountNumber: String(banking.accountNumber || "").replace(/\D/g, ""),
    abaRoutingNumber: String(banking.abaRoutingNumber || "").replace(/\D/g, ""),
    ...(clearStripe
      ? {
          stripeCustomerId: null,
          stripePaymentMethodId: null,
        }
      : {}),
    ...(authorizeAchDebit
      ? {
          achDebitAuthorizedAt: new Date(),
          achDebitAuthorizedById: authorizedByUserId || null,
        }
      : {}),
  };

  if (existing) {
    return db.organizationBankingProfile.update({
      where: { organizationId },
      data,
    });
  }

  return db.organizationBankingProfile.create({
    data: {
      id: randomUUID(),
      organizationId,
      ...data,
    },
  });
}

module.exports = {
  formatOrgBanking,
  getOrganizationBanking,
  upsertOrganizationBanking,
  requireBankingFromFields,
  maskLast4,
};
