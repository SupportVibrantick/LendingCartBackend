/**
 * Print a one-time set-password URL for a broker email (no SMTP required).
 * Usage: node scripts/printBrokerSetPasswordLink.js <email>
 */
require("dotenv").config();
const crypto = require("crypto");
const prisma = require("../config/prisma");
const {
  buildBrokerSignInUrl,
  getEmailBranding,
} = require("../utils/email/emailBranding");

async function main() {
  const email = String(process.argv[2] || "")
    .trim()
    .toLowerCase();
  if (!email) {
    console.error("Usage: node scripts/printBrokerSetPasswordLink.js <email>");
    process.exit(1);
  }

  // Use shared prisma client
  try {
    const user = await prisma.userAccount.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, firstName: true },
    });
    if (!user) throw new Error(`No broker user for ${email}`);

    const token = crypto.randomBytes(32).toString("hex");
    const hours = Number(process.env.PASSWORD_RESET_EXPIRY_HOURS || 1);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const { brokerDashboardUrl } = getEmailBranding();
    const baseUrl =
      buildBrokerSignInUrl().replace(/\/signin$/, "") || brokerDashboardUrl;
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    console.log(
      JSON.stringify(
        {
          email: user.email,
          expiresAt,
          setPasswordUrl: resetUrl,
          signInUrl: buildBrokerSignInUrl(),
          note: "Open setPasswordUrl, choose a password, then sign in.",
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
