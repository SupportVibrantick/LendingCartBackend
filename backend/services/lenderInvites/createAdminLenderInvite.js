const { loadTemplate } = require("../../utils/email/loadTemplate");
const { buildLenderInviteUrl } = require("../../utils/email/emailBranding");
const {
  buildLenderInviteEmailData,
} = require("../../utils/email/emailTemplateData");
const sendMail = require("../emails/mail");
const {
  generateInviteToken,
  buildInviteExpiry,
  mapInviteForAdmin,
} = require("./adminLenderInviteHelpers");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeInviteRow(row = {}) {
  const companyName = String(
    row.companyName ?? row.company ?? row.company_name ?? "",
  ).trim();
  const fullName = String(
    row.fullName ?? row.name ?? row.full_name ?? "",
  ).trim();
  const email = String(row.email ?? "").trim().toLowerCase();
  const phoneDigits = String(row.phone ?? row.phoneNumber ?? "")
    .replace(/\D/g, "")
    .trim();

  return {
    companyName,
    fullName,
    email,
    phone: phoneDigits,
  };
}

function validateInviteRowShape(row) {
  const errors = [];

  if (!row.companyName) errors.push("Company name is required");
  if (!row.fullName) errors.push("Full name is required");
  if (!row.email) {
    errors.push("Email is required");
  } else if (!EMAIL_REGEX.test(row.email)) {
    errors.push("Invalid email address");
  }
  if (!row.phone) {
    errors.push("Phone is required");
  } else if (row.phone.length < 10) {
    errors.push("Phone must have at least 10 digits");
  }

  return errors;
}

/**
 * Check DB-level conflicts for a single invite row.
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ email: string }} row
 */
async function checkInviteRowConflicts(prisma, row) {
  const errors = [];

  const existingUser = await prisma.userAccount.findFirst({
    where: { email: row.email, isDeleted: false },
    select: { id: true },
  });
  if (existingUser) {
    errors.push("A user with this email already exists");
  }

  const pendingInvite = await prisma.adminLenderInvite.findFirst({
    where: {
      email: row.email,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (pendingInvite) {
    errors.push("A pending invitation already exists for this email");
  }

  return errors;
}

/**
 * Create invite record and enqueue email via outbox worker.
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ companyName: string, fullName: string, email: string, phone: string, invitedByAdminId?: string|null }} input
 */
async function createAdminLenderInviteAndEnqueue(prisma, input) {
  const companyName = String(input.companyName || "").trim();
  const fullName = String(input.fullName || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const phone = String(input.phone || "").replace(/\D/g, "");

  const shapeErrors = validateInviteRowShape({
    companyName,
    fullName,
    email,
    phone,
  });
  if (shapeErrors.length) {
    const err = new Error(shapeErrors.join("; "));
    err.code = "VALIDATION";
    throw err;
  }

  const conflictErrors = await checkInviteRowConflicts(prisma, { email });
  if (conflictErrors.length) {
    const err = new Error(conflictErrors.join("; "));
    err.code = "CONFLICT";
    throw err;
  }

  const token = generateInviteToken();
  const expiresAt = buildInviteExpiry();

  const invite = await prisma.adminLenderInvite.create({
    data: {
      companyName,
      fullName,
      email,
      phone,
      token,
      status: "PENDING",
      expiresAt,
      lastSentAt: new Date(),
      invitedByAdminId: input.invitedByAdminId || null,
    },
  });

  const signupUrl = buildLenderInviteUrl(token);
  const html = loadTemplate(
    "admin/lender/invite",
    buildLenderInviteEmailData({
      name: fullName,
      email,
      phone,
      companyName,
      signupUrl,
    }),
  );

  await sendMail({
    prisma,
    to: email,
    subject: "LendingCart has invited you to join as a Lender",
    text: `Hello ${fullName}, LendingCart has invited you to join as a Lender. Accept your invitation: ${signupUrl}`,
    html,
    idempotencyKey: `admin-lender-invite:${invite.id}:${Date.now()}`,
  });

  return mapInviteForAdmin(invite);
}

module.exports = {
  EMAIL_REGEX,
  normalizeInviteRow,
  validateInviteRowShape,
  checkInviteRowConflicts,
  createAdminLenderInviteAndEnqueue,
};
