/**
 * Loan officer / co-broker self-service banking (add + update own profile).
 */

const {
  formatBankingForAdmin,
  upsertUserBankingProfile,
  requireBankingFromFields,
} = require("./userBankingProfile.service");
const { maskAccountLast4 } = require("../../utils/commission/commissionHelpers");

function formatOwnBanking(profile) {
  if (!profile) return null;
  return {
    ...formatBankingForAdmin(profile),
    accountLast4: maskAccountLast4(profile.accountNumber),
    updatedAt: profile.updatedAt || null,
  };
}

async function getOwnBanking(db, userId) {
  return db.userBankingProfile.findUnique({ where: { userId } });
}

/**
 * @param {import("@prisma/client").PrismaClient | import("@prisma/client").Prisma.TransactionClient} db
 */
async function upsertOwnBanking(db, userId, fields) {
  const bankingResult = requireBankingFromFields(fields || {});
  if (bankingResult.error) {
    const error = new Error(bankingResult.error);
    error.statusCode = 400;
    throw error;
  }

  return upsertUserBankingProfile(db, userId, bankingResult.banking);
}

module.exports = {
  formatOwnBanking,
  getOwnBanking,
  upsertOwnBanking,
  requireBankingFromFields,
};
