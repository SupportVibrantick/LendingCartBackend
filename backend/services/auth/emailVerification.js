const crypto = require("crypto");
const { loadTemplate } = require("../../utils/email/loadTemplate");
const {
  buildLenderVerifyEmailUrl,
  getEmailBranding,
} = require("../../utils/email/emailBranding");
const sendMail = require("../emails/mail");

const VERIFY_TTL_HOURS = Number(process.env.EMAIL_VERIFY_TTL_HOURS || 24);

function generateVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function buildVerificationExpiry(from = new Date()) {
  const expiresAt = new Date(from);
  expiresAt.setHours(expiresAt.getHours() + VERIFY_TTL_HOURS);
  return expiresAt;
}

/**
 * Create verification token and enqueue email.
 */
async function createAndSendEmailVerification(prisma, user) {
  const token = generateVerificationToken();
  const expiresAt = buildVerificationExpiry();

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  const verifyUrl = buildLenderVerifyEmailUrl(token);
  const branding = getEmailBranding();
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || "there";

  const html = loadTemplate("lender/verify-email", {
    ...branding,
    name,
    email: user.email,
    verifyUrl,
  });

  await sendMail({
    prisma,
    to: user.email,
    subject: "Verify your LendingCart lender email",
    text: `Hello ${name}, verify your email: ${verifyUrl}`,
    html,
    idempotencyKey: `lender-email-verify:${user.id}:${token}`,
  });

  return { token, expiresAt, verifyUrl };
}

module.exports = {
  VERIFY_TTL_HOURS,
  generateVerificationToken,
  buildVerificationExpiry,
  createAndSendEmailVerification,
};
