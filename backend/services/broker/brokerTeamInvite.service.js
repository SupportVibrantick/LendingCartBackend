const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { getEmailBranding } = require("../../utils/email/emailBranding");
const {
  sendLoanOfficerCredentialsEmail,
} = require("../emails/loanOfficerCredentialsEmail");
const {
  sendSubBrokerCredentialsEmail,
} = require("../emails/subBrokerCredentialsEmail");
const {
  assertSeatAvailable,
} = require("../subscription/subscriptionBilling");
const {
  getOrgEnabledFeatures,
  orgAllowsPermission,
} = require("../subscription/brokerOrgFeatures");
const {
  DEFAULT_PUBLIC_JOIN_LO_PERMISSIONS,
} = require("../../utils/broker/loanOfficerPermissions");
const {
  syncUserPermissions,
} = require("../../utils/broker/brokerUserProfileHelpers");

const INVITE_EXPIRY_HOURS = Number(
  process.env.BROKER_TEAM_INVITE_EXPIRY_HOURS || 72,
);

function joinPathForRole(role) {
  return role === "SUB_BROKER" ? "/join/co-broker" : "/join/loan-officer";
}

function buildInviteUrl(token, role) {
  const { brokerDashboardUrl } = getEmailBranding();
  const base = String(brokerDashboardUrl || "")
    .trim()
    .replace(/\/$/, "");
  const path = joinPathForRole(role);
  if (!base) return `${path}?token=${encodeURIComponent(token)}`;
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

function generateTempPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;
  const pick = (set) => set[crypto.randomInt(0, set.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  for (let i = 0; i < 8; i += 1) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function validateBankingPayload(body) {
  const accountType = String(body.accountType || "")
    .trim()
    .toUpperCase();
  if (accountType !== "PERSONAL" && accountType !== "BUSINESS") {
    return { error: "Account type must be Personal or Business" };
  }

  const partyName = String(body.partyName || "").trim();
  const partyAddress = String(body.partyAddress || "").trim();
  const partyTel = String(body.partyTel || "").trim();
  const partyEmail = normalizeEmail(body.partyEmail);
  const bankName = String(body.bankName || "").trim();
  const bankTel = String(body.bankTel || "").trim();
  const accountName = String(body.accountName || "").trim();
  const accountNumber = String(body.accountNumber || "").trim();
  const abaRoutingNumber = String(body.abaRoutingNumber || "").trim();

  if (!partyName) return { error: "Name is required" };
  if (!partyAddress) return { error: "Address is required" };
  if (!partyTel) return { error: "Telephone is required" };
  if (!partyEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partyEmail)) {
    return { error: "A valid email is required" };
  }
  if (!bankName) return { error: "Bank name is required" };
  if (!bankTel) return { error: "Bank telephone is required" };
  if (!accountName) return { error: "Account name is required" };
  if (!accountNumber) return { error: "Account number is required" };
  if (!abaRoutingNumber) return { error: "ABA/Routing number is required" };

  return {
    banking: {
      accountType,
      partyName,
      partyAddress,
      partyTel,
      partyEmail,
      bankName,
      bankTel,
      accountName,
      accountNumber,
      abaRoutingNumber,
    },
  };
}

async function createBrokerTeamInvite(prisma, {
  organizationId,
  role,
  createdById,
}) {
  if (role !== "LOAN_OFFICER" && role !== "SUB_BROKER") {
    const err = new Error("Invalid invite role");
    err.statusCode = 400;
    throw err;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  const invite = await prisma.$transaction(async (tx) => {
    await tx.brokerTeamInvite.updateMany({
      where: {
        organizationId,
        role,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        expiresAt: new Date(),
      },
    });

    return tx.brokerTeamInvite.create({
      data: {
        organizationId,
        role,
        token,
        expiresAt,
        createdById: createdById || null,
      },
    });
  });

  return {
    id: invite.id,
    role: invite.role,
    token: invite.token,
    expiresAt: invite.expiresAt,
    inviteUrl: buildInviteUrl(invite.token, invite.role),
    expiresInHours: INVITE_EXPIRY_HOURS,
  };
}

async function getValidInvite(prisma, token) {
  const clean = String(token || "").trim();
  if (!clean) return null;

  const invite = await prisma.brokerTeamInvite.findFirst({
    where: {
      token: clean,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      organization: {
        select: { id: true, name: true, type: true, status: true, isDeleted: true },
      },
    },
  });

  if (
    !invite ||
    !invite.organization ||
    invite.organization.type !== "BROKER" ||
    invite.organization.status !== "ACTIVE" ||
    invite.organization.isDeleted
  ) {
    return null;
  }

  return invite;
}

async function registerFromBrokerTeamInvite(prisma, {
  token,
  firstName,
  lastName,
  email,
  phone,
  banking,
}) {
  const invite = await getValidInvite(prisma, token);
  if (!invite) {
    const err = new Error("Invalid or expired invite link");
    err.statusCode = 400;
    throw err;
  }

  const brokerOrgId = invite.organizationId;
  const roleName = invite.role === "SUB_BROKER" ? "SUB_BROKER" : "BROKER_OFFICER";
  const seatType = invite.role === "SUB_BROKER" ? "CO_BROKERS" : "LOAN_OFFICERS";

  if (invite.role === "SUB_BROKER") {
    const orgEntitlements = await getOrgEnabledFeatures(prisma, brokerOrgId);
    if (
      !orgAllowsPermission(orgEntitlements.permissions, "EDIT_CO_BROKERS") &&
      !orgAllowsPermission(orgEntitlements.permissions, "VIEW_CO_BROKERS")
    ) {
      const err = new Error(
        "Co-Broker portals are not included in this broker plan.",
      );
      err.statusCode = 403;
      throw err;
    }
  }

  const seatCheck = await assertSeatAvailable(prisma, brokerOrgId, seatType);
  if (!seatCheck.ok) {
    const err = new Error(seatCheck.message || "Seat limit reached");
    err.statusCode = seatCheck.statusCode || 403;
    err.code = seatCheck.code;
    throw err;
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const err = new Error("A valid email is required");
    err.statusCode = 400;
    throw err;
  }

  const cleanFirst = String(firstName || "").trim();
  const cleanLast = String(lastName || "").trim();
  if (!cleanFirst || !cleanLast) {
    const err = new Error("First name and last name are required");
    err.statusCode = 400;
    throw err;
  }

  const existingUser = await prisma.userAccount.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: "insensitive" },
      isDeleted: { not: true },
    },
  });
  if (existingUser) {
    const err = new Error("Email already registered");
    err.statusCode = 400;
    throw err;
  }

  const roleRecord = await prisma.role.findFirst({ where: { name: roleName } });
  if (!roleRecord) {
    const err = new Error("Role configuration error");
    err.statusCode = 500;
    throw err;
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const cleanPhone = String(phone || "").trim() || null;

  const result = await prisma.$transaction(async (tx) => {
    const freshInvite = await tx.brokerTeamInvite.findFirst({
      where: {
        id: invite.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!freshInvite) {
      const err = new Error("Invalid or expired invite link");
      err.statusCode = 400;
      throw err;
    }

    const user = await tx.userAccount.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: cleanFirst,
        lastName: cleanLast,
        phone: cleanPhone,
        organizationId: brokerOrgId,
        status: "ACTIVE",
        createdById: invite.createdById || null,
        emailVerifiedAt: new Date(),
      },
    });

    await tx.userRole.create({
      data: { userId: user.id, roleId: roleRecord.id },
    });

    if (invite.role === "LOAN_OFFICER") {
      await tx.brokerUserProfile.create({
        data: {
          userId: user.id,
          agentType: "Loan Officer",
          address: banking.partyAddress,
          profileData: {
            source: "PUBLIC_TEAM_INVITE",
          },
        },
      });

      // Public join has no broker permission picker — grant a safe baseline.
      await syncUserPermissions(
        tx,
        user.id,
        DEFAULT_PUBLIC_JOIN_LO_PERMISSIONS,
      );
    } else {
      await tx.subBrokerProfile.create({
        data: {
          userId: user.id,
          profileData: {
            source: "PUBLIC_TEAM_INVITE",
            agentType: "Co-Broker",
            address: banking.partyAddress,
            primaryContact: {
              firstName: cleanFirst,
              lastName: cleanLast,
              email: normalizedEmail,
              phone: cleanPhone,
            },
          },
        },
      });
    }

    await tx.userBankingProfile.create({
      data: {
        userId: user.id,
        accountType: banking.accountType,
        partyName: banking.partyName,
        partyAddress: banking.partyAddress,
        partyTel: banking.partyTel,
        partyEmail: banking.partyEmail,
        bankName: banking.bankName,
        bankTel: banking.bankTel,
        accountName: banking.accountName,
        accountNumber: banking.accountNumber,
        abaRoutingNumber: banking.abaRoutingNumber,
      },
    });

    await tx.brokerTeamInvite.update({
      where: { id: invite.id },
      data: {
        usedAt: new Date(),
        usedByUserId: user.id,
      },
    });

    return user;
  });

  return {
    user: result,
    tempPassword,
    role: invite.role,
    organizationName: invite.organization.name,
    organizationId: brokerOrgId,
  };
}

async function sendJoinCredentialsEmail({
  role,
  firstName,
  email,
  password,
  organizationName,
  prisma,
}) {
  if (role === "SUB_BROKER") {
    return sendSubBrokerCredentialsEmail({
      firstName,
      email,
      password,
      organizationName,
      prisma,
    });
  }

  return sendLoanOfficerCredentialsEmail({
    firstName,
    email,
    password,
    organizationName,
    prisma,
  });
}

function maskBankingProfile(profile) {
  if (!profile) return null;
  const last4 = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return null;
    return `••••${digits.slice(-4)}`;
  };

  return {
    accountType: profile.accountType,
    partyName: profile.partyName,
    partyAddress: profile.partyAddress,
    partyTel: profile.partyTel,
    partyEmail: profile.partyEmail,
    bankName: profile.bankName,
    bankTel: profile.bankTel,
    accountName: profile.accountName,
    accountNumberMasked: last4(profile.accountNumber),
    abaRoutingNumberMasked: last4(profile.abaRoutingNumber),
  };
}

module.exports = {
  INVITE_EXPIRY_HOURS,
  buildInviteUrl,
  createBrokerTeamInvite,
  getValidInvite,
  registerFromBrokerTeamInvite,
  sendJoinCredentialsEmail,
  validateBankingPayload,
  maskBankingProfile,
  generateTempPassword,
};
