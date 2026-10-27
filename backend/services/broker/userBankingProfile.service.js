/**
 * Shared UserBankingProfile helpers for invite join and admin create/edit.
 */

const { validateBankingPayload } = require("./brokerTeamInvite.service");

function formatBankingForAdmin(profile) {
  if (!profile) return null;
  return {
    accountType: profile.accountType,
    partyName: profile.partyName || "",
    partyAddress: profile.partyAddress || "",
    partyTel: profile.partyTel || "",
    partyEmail: profile.partyEmail || "",
    bankName: profile.bankName || "",
    bankTel: profile.bankTel || "",
    accountName: profile.accountName || "",
    accountNumber: profile.accountNumber || "",
    abaRoutingNumber: profile.abaRoutingNumber || "",
  };
}

function bankingFingerprint(banking) {
  return [
    banking.accountType,
    banking.accountName,
    String(banking.accountNumber || "").replace(/\D/g, ""),
    String(banking.abaRoutingNumber || "").replace(/\D/g, ""),
  ].join("|");
}

/**
 * @param {import("@prisma/client").PrismaClient | import("@prisma/client").Prisma.TransactionClient} db
 */
async function upsertUserBankingProfile(db, userId, banking) {
  const existing = await db.userBankingProfile.findUnique({
    where: { userId },
  });

  const nextFingerprint = bankingFingerprint(banking);
  const prevFingerprint = existing
    ? bankingFingerprint(existing)
    : null;
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
          stripeConnectedAccountId: null,
          stripeExternalAccountId: null,
        }
      : {}),
  };

  return db.userBankingProfile.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
    },
    update: data,
  });
}

function requireBankingFromFields(fields) {
  const result = validateBankingPayload(fields || {});
  if (result.error) return { error: result.error };

  const accountNumber = String(result.banking.accountNumber || "").replace(
    /\D/g,
    "",
  );
  const abaRoutingNumber = String(result.banking.abaRoutingNumber || "").replace(
    /\D/g,
    "",
  );
  const partyTel = String(result.banking.partyTel || "").replace(/\D/g, "");
  const bankTel = String(result.banking.bankTel || "").replace(/\D/g, "");

  if (!/^\d{4,17}$/.test(accountNumber)) {
    return { error: "Enter a valid account number (4–17 digits)" };
  }
  if (!/^\d{9}$/.test(abaRoutingNumber)) {
    return { error: "Routing number must be 9 digits" };
  }
  if (partyTel.length !== 10) {
    return { error: "Banking telephone must be a 10-digit phone number" };
  }
  if (bankTel.length !== 10) {
    return { error: "Bank telephone must be a 10-digit phone number" };
  }

  return {
    banking: {
      ...result.banking,
      accountNumber,
      abaRoutingNumber,
      partyTel,
      bankTel,
    },
  };
}

module.exports = {
  formatBankingForAdmin,
  upsertUserBankingProfile,
  requireBankingFromFields,
};
