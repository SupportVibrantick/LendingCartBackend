const { loadTemplate } = require("../../utils/email/loadTemplate");
const { buildLenderInviteUrl } = require("../../utils/email/emailBranding");
const { buildLenderInviteEmailData } = require("../../utils/email/emailTemplateData");
const sendMail = require("../emails/mail");
const {
  generateInviteToken,
  buildInviteExpiry,
} = require("./adminLenderInviteHelpers");
const {
  EMAIL_REGEX,
  normalizeEmail,
  normalizeCompanyName,
  findDuplicateLender,
} = require("./brokerLenderDuplicateCheck");

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function validateSubmitPayload(body) {
  const errors = [];
  const companyName = normalizeCompanyName(body.companyName);
  const businessEmail = normalizeEmail(body.businessEmail);
  const contactPerson = String(body.contactPerson || "").trim();
  const phone = normalizePhone(body.phone);
  const website = String(body.website || "").trim();
  const notes = String(body.notes || "").trim();

  if (!companyName) errors.push("Company name is required");
  if (!businessEmail) {
    errors.push("Business email is required");
  } else if (!EMAIL_REGEX.test(businessEmail)) {
    errors.push("Invalid business email");
  }
  if (!contactPerson) errors.push("Contact person is required");
  if (!phone) {
    errors.push("Phone is required");
  } else if (phone.length < 10) {
    errors.push("Phone must have at least 10 digits");
  }

  return {
    errors,
    data: { companyName, businessEmail, contactPerson, phone, website, notes },
  };
}

async function sendBrokerLenderInviteEmail(prisma, invite, brokerOrgName) {
  const signupUrl = buildLenderInviteUrl(invite.token);
  const html = loadTemplate(
    "admin/lender/invite",
    buildLenderInviteEmailData({
      name: invite.fullName,
      email: invite.email,
      phone: invite.phone,
      companyName: invite.companyName,
      signupUrl,
      invitedBy: brokerOrgName || "a broker partner",
    }),
  );

  await sendMail({
    prisma,
    to: invite.email,
    subject: "You have been invited to join LendingCart as a Lender",
    text: `Hello ${invite.fullName}, ${brokerOrgName || "A broker"} invited you to join LendingCart as a lender. Accept your invitation: ${signupUrl}`,
    html,
    idempotencyKey: `broker-lender-invite:${invite.id}:${Date.now()}`,
  });
}

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 */
async function submitBrokerLender(prisma, input) {
  const duplicate = await findDuplicateLender(
    prisma,
    {
      companyName: input.companyName,
      businessEmail: input.businessEmail,
      website: input.website,
    },
    input.brokerOrgId,
  );

  if (duplicate.duplicate) {
    const err = new Error("This lender already exists.");
    err.code = "DUPLICATE";
    err.duplicate = duplicate;
    throw err;
  }

  const token = generateInviteToken();
  const expiresAt = buildInviteExpiry();

  let result;

  await prisma.$transaction(async (tx) => {
    const lenderOrg = await tx.organization.create({
      data: {
        name: input.companyName,
        type: "LENDER",
        status: "ACTIVE",
        email: input.businessEmail,
        phone: input.phone,
      },
    });

    await tx.lenderProfile.create({
      data: {
        lenderOrgId: lenderOrg.id,
        profileStatus: "INCOMPLETE",
        isVisible: false,
        website: input.website || null,
        summary: input.notes || null,
        submittedByBrokerOrgId: input.brokerOrgId,
      },
    });

    const invite = await tx.adminLenderInvite.create({
      data: {
        companyName: input.companyName,
        fullName: input.contactPerson,
        email: input.businessEmail,
        phone: input.phone,
        notes: input.notes || null,
        token,
        status: "PENDING",
        expiresAt,
        lastSentAt: new Date(),
        lenderOrgId: lenderOrg.id,
        invitedByBrokerOrgId: input.brokerOrgId,
        invitedByBrokerUserId: input.brokerUserId,
        inviteSource: "BROKER",
      },
    });

    result = { lenderOrg, invite };
  });

  const brokerOrg = await prisma.organization.findUnique({
    where: { id: input.brokerOrgId },
    select: { name: true },
  });

  await sendBrokerLenderInviteEmail(prisma, result.invite, brokerOrg?.name);

  return mapSubmission(result.invite, result.lenderOrg);
}

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 */
async function resendBrokerLenderInvite(prisma, inviteId, brokerOrgId) {
  const invite = await prisma.adminLenderInvite.findFirst({
    where: {
      id: inviteId,
      invitedByBrokerOrgId: brokerOrgId,
      inviteSource: "BROKER",
    },
    include: {
      lenderOrg: {
        select: {
          id: true,
          name: true,
          status: true,
          email: true,
          phone: true,
          lenderProfile: {
            select: { profileStatus: true, isVisible: true, website: true },
          },
        },
      },
    },
  });

  if (!invite) {
    const err = new Error("Submission not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (invite.status === "ACCEPTED") {
    const err = new Error("This lender has already accepted the invitation");
    err.code = "ALREADY_ACCEPTED";
    throw err;
  }

  const newToken = generateInviteToken();
  const expiresAt = buildInviteExpiry();

  const updated = await prisma.adminLenderInvite.update({
    where: { id: invite.id },
    data: {
      token: newToken,
      status: "PENDING",
      expiresAt,
      lastSentAt: new Date(),
      tokenUsedAt: null,
      declinedAt: null,
      cancelledAt: null,
    },
  });

  const brokerOrg = await prisma.organization.findUnique({
    where: { id: brokerOrgId },
    select: { name: true },
  });

  await sendBrokerLenderInviteEmail(prisma, updated, brokerOrg?.name);

  return mapSubmission(updated, invite.lenderOrg);
}

function mapSubmissionStatus(invite, lenderOrg) {
  if (invite.status === "ACCEPTED") {
    const profileComplete =
      lenderOrg?.lenderProfile?.profileStatus === "COMPLETED" &&
      lenderOrg?.lenderProfile?.isVisible;
    return profileComplete ? "PROFILE_COMPLETE" : "ACCEPTED";
  }
  if (invite.status === "PENDING") {
    if (invite.expiresAt < new Date()) return "EXPIRED";
    return "INVITE_SENT";
  }
  if (invite.status === "EXPIRED") return "EXPIRED";
  if (invite.status === "DECLINED") return "DECLINED";
  if (invite.status === "CANCELLED") return "CANCELLED";
  return invite.status;
}

function mapSubmission(invite, lenderOrg) {
  return {
    id: invite.id,
    lenderOrgId: invite.lenderOrgId,
    companyName: invite.companyName,
    contactPerson: invite.fullName,
    businessEmail: invite.email,
    phone: invite.phone,
    website: lenderOrg?.lenderProfile?.website || null,
    notes: invite.notes,
    inviteStatus: invite.status,
    submissionStatus: mapSubmissionStatus(invite, lenderOrg),
    expiresAt: invite.expiresAt,
    lastSentAt: invite.lastSentAt,
    acceptedAt: invite.acceptedAt,
    createdAt: invite.createdAt,
    lender: lenderOrg
      ? {
          id: lenderOrg.id,
          name: lenderOrg.name,
          status: lenderOrg.status,
          profileStatus: lenderOrg.lenderProfile?.profileStatus || null,
          isVisible: lenderOrg.lenderProfile?.isVisible ?? false,
        }
      : null,
  };
}

module.exports = {
  validateSubmitPayload,
  submitBrokerLender,
  resendBrokerLenderInvite,
  mapSubmission,
  mapSubmissionStatus,
  sendBrokerLenderInviteEmail,
};
