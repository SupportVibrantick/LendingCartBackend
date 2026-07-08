const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");

const PROFILE_JSON_FIELDS = [
  "loanTypesOffered",
  "statesAuthorized",
  "brokerStates",
  "companyStateLicenseStates",
  "personalStateLicenseStates",
  "branchIds",
  "assignedLoanOfficerIds",
];

const PROFILE_BOOLEAN_FIELDS = [
  "allowedToLogin",
  "hasCompanyNmls",
  "hasPersonalNmls",
  "hasCompanyStateLicense",
  "hasPersonalStateLicense",
  "useSameContact",
];

function parseJsonField(value, fallback = []) {
  if (value == null || value === "") return fallback;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseBooleanField(value, fallback = false) {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return fallback;
}

function resolvePrimaryContactFields(fields = {}) {
  const useSameContact = parseBooleanField(fields.useSameContact, true);

  const businessFirstName = String(fields.firstName || "").trim();
  const businessLastName = String(fields.lastName || "").trim();
  const businessEmail = String(fields.email || "").trim().toLowerCase();
  const businessPhone = String(fields.phone || "").replace(/\D/g, "");

  const contactFirstName = String(fields.contactFirstName || "").trim();
  const contactLastName = String(fields.contactLastName || "").trim();
  const contactEmail = String(fields.contactEmail || "").trim().toLowerCase();
  const contactPhone = String(fields.contactPhone || "").replace(/\D/g, "");

  if (useSameContact) {
    return {
      useSameContact: true,
      account: {
        firstName: businessFirstName,
        lastName: businessLastName,
        email: businessEmail,
        phone: businessPhone,
      },
      contact: {
        firstName: businessFirstName,
        lastName: businessLastName,
        email: businessEmail,
        phone: businessPhone,
      },
      businessContact: null,
    };
  }

  return {
    useSameContact: false,
    account: {
      firstName: contactFirstName,
      lastName: contactLastName,
      email: contactEmail,
      phone: contactPhone,
    },
    contact: {
      firstName: contactFirstName,
      lastName: contactLastName,
      email: contactEmail,
      phone: contactPhone,
    },
    businessContact: {
      firstName: businessFirstName,
      lastName: businessLastName,
      email: businessEmail,
      phone: businessPhone,
    },
  };
}

function validatePrimaryContactFields(fields = {}) {
  const resolved = resolvePrimaryContactFields(fields);

  if (!resolved.account.firstName) {
    return { error: "First name is required" };
  }
  if (resolved.account.firstName.length < 2) {
    return { error: "First name must be at least 2 characters" };
  }
  if (!resolved.account.lastName) {
    return { error: "Last name is required" };
  }
  if (!resolved.account.email) {
    return { error: "Email is required" };
  }
  if (!/^\S+@\S+\.\S+$/.test(resolved.account.email)) {
    return { error: "Invalid email format" };
  }
  if (!resolved.account.phone) {
    return { error: "Phone is required" };
  }
  if (resolved.account.phone.length < 10) {
    return { error: "Enter a valid 10-digit phone number" };
  }

  if (!resolved.useSameContact) {
    if (!resolved.businessContact?.firstName) {
      return { error: "Business contact first name is required" };
    }
    if (!resolved.businessContact?.lastName) {
      return { error: "Business contact last name is required" };
    }
    if (!resolved.businessContact?.email) {
      return { error: "Business contact email is required" };
    }
    if (!/^\S+@\S+\.\S+$/.test(resolved.businessContact.email)) {
      return { error: "Invalid business contact email format" };
    }
    if (!resolved.businessContact?.phone) {
      return { error: "Business contact phone is required" };
    }
    if (resolved.businessContact.phone.length < 10) {
      return { error: "Enter a valid 10-digit business contact phone number" };
    }
  }

  return { error: null, ...resolved };
}

function buildProfileDataFromFields(fields = {}) {
  const profileData = {};
  const resolved = resolvePrimaryContactFields(fields);

  const scalarKeys = [
    "partnerType",
    "company",
    "tollFree",
    "address",
    "agentType",
    "ssn",
    "linkedinUrl",
    "companyNmls",
    "personalNmls",
    "companyStateLicense",
    "personalStateLicense",
    "findersFee",
    "ein",
    "preferredComm",
    "website",
    "employeeCount",
    "experience",
  ];

  for (const key of scalarKeys) {
    if (fields[key] !== undefined && fields[key] !== "") {
      profileData[key] = String(fields[key]).trim();
    }
  }

  for (const key of PROFILE_BOOLEAN_FIELDS) {
    if (fields[key] !== undefined) {
      profileData[key] = parseBooleanField(fields[key]);
    }
  }

  for (const key of PROFILE_JSON_FIELDS) {
    if (fields[key] !== undefined) {
      profileData[key] = parseJsonField(fields[key]);
    }
  }

  profileData.useSameContact = resolved.useSameContact;
  profileData.contactFirstName = resolved.contact.firstName;
  profileData.contactLastName = resolved.contact.lastName;
  profileData.contactEmail = resolved.contact.email;
  profileData.contactPhone = resolved.contact.phone;

  if (resolved.businessContact) {
    profileData.businessContact = resolved.businessContact;
  }

  return profileData;
}

async function parseMultipartRequest(req) {
  const contentType = req.headers["content-type"] || "";

  if (!contentType.includes("multipart/form-data")) {
    return {
      fields: { ...req.body },
      logoUrl: null,
      w9Url: null,
    };
  }

  const fields = {};
  let logoUrl = null;
  let w9Url = null;

  const parts = req.parts();

  for await (const part of parts) {
    if (part.type === "file") {
      const saved = await saveSubBrokerFile(part);
      if (part.fieldname === "logo") logoUrl = saved;
      if (part.fieldname === "w9") w9Url = saved;
      continue;
    }

    fields[part.fieldname] = part.value;
  }

  return { fields, logoUrl, w9Url };
}

async function saveSubBrokerFile(part) {
  const uploadDir = path.join(process.cwd(), "public/broker/cobroker");

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const safeName = part.filename.replace(/\s+/g, "_");
  const fileName = `${Date.now()}-${safeName}`;
  const filePath = path.join(uploadDir, fileName);

  await pipeline(part.file, fs.createWriteStream(filePath));

  return `/public/broker/cobroker/${fileName}`;
}

async function validateLoanOfficerIds(prisma, brokerOrgId, loanOfficerIds = []) {
  const uniqueIds = [...new Set((loanOfficerIds || []).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const officers = await prisma.userAccount.findMany({
    where: {
      id: { in: uniqueIds },
      organizationId: brokerOrgId,
      isDeleted: false,
      status: "ACTIVE",
      roles: {
        some: {
          role: { name: "BROKER_OFFICER" },
        },
      },
    },
    select: { id: true },
  });

  if (officers.length !== uniqueIds.length) {
    throw new Error("One or more assigned loan officers are invalid");
  }

  return uniqueIds;
}

async function syncSubBrokerLoanOfficers(prisma, subBrokerId, loanOfficerIds, brokerOrgId) {
  const validIds = await validateLoanOfficerIds(prisma, brokerOrgId, loanOfficerIds);

  await prisma.subBrokerLoanOfficer.deleteMany({
    where: { subBrokerId },
  });

  if (validIds.length === 0) return [];

  await prisma.subBrokerLoanOfficer.createMany({
    data: validIds.map((loanOfficerId) => ({
      subBrokerId,
      loanOfficerId,
    })),
    skipDuplicates: true,
  });

  return validIds;
}

async function validateSubBrokerIds(prisma, brokerOrgId, subBrokerIds = []) {
  const uniqueIds = [...new Set((subBrokerIds || []).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const subBrokers = await prisma.userAccount.findMany({
    where: {
      id: { in: uniqueIds },
      organizationId: brokerOrgId,
      isDeleted: false,
      status: "ACTIVE",
      roles: {
        some: {
          role: { name: "SUB_BROKER" },
        },
      },
    },
    select: { id: true },
  });

  if (subBrokers.length !== uniqueIds.length) {
    throw new Error("One or more assigned co-brokers are invalid");
  }

  return uniqueIds;
}

async function syncLoanOfficerSubBrokers(
  prisma,
  loanOfficerId,
  subBrokerIds,
  brokerOrgId,
) {
  const validIds = await validateSubBrokerIds(prisma, brokerOrgId, subBrokerIds);

  await prisma.subBrokerLoanOfficer.deleteMany({
    where: { loanOfficerId },
  });

  if (validIds.length === 0) return [];

  await prisma.subBrokerLoanOfficer.createMany({
    data: validIds.map((subBrokerId) => ({
      subBrokerId,
      loanOfficerId,
    })),
    skipDuplicates: true,
  });

  return validIds;
}

function formatAssignedLoanOfficers(links = []) {
  return links.map((link) => ({
    id: link.loanOfficer.id,
    firstName: link.loanOfficer.firstName,
    lastName: link.loanOfficer.lastName,
    email: link.loanOfficer.email,
    profileImage: link.loanOfficer.profileImage,
  }));
}

function formatAssignedSubBrokers(links = []) {
  return links.map((link) => ({
    id: link.subBroker.id,
    firstName: link.subBroker.firstName,
    lastName: link.subBroker.lastName,
    email: link.subBroker.email,
    profileImage: link.subBroker.profileImage,
  }));
}

function formatSubBrokerDetail(user, profile, loanOfficerLinks = []) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    createdById: user.createdById,
    profile: profile
      ? {
          logoUrl: profile.logoUrl,
          w9Url: profile.w9Url,
          ...(profile.profileData || {}),
        }
      : {},
    assignedLoanOfficers: formatAssignedLoanOfficers(loanOfficerLinks),
    assignedLoanOfficerIds: formatAssignedLoanOfficers(loanOfficerLinks).map(
      (officer) => officer.id,
    ),
  };
}

const subBrokerInclude = {
  subBrokerProfile: true,
  subBrokerLoanOfficers: {
    include: {
      loanOfficer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profileImage: true,
        },
      },
    },
  },
};

function formatCoBrokerAuthResponse(user, branding, assignedApplicationsCount) {
  const detail = formatSubBrokerDetail(
    user,
    user.subBrokerProfile,
    user.subBrokerLoanOfficers || [],
  );

  return {
    user: {
      id: detail.id,
      email: detail.email,
      firstName: detail.firstName,
      lastName: detail.lastName,
      name: `${detail.firstName || ""} ${detail.lastName || ""}`.trim(),
      phone: detail.phone,
      profileImage: user.profileImage || null,
      status: detail.status,
      roles: (user.roles || []).map((entry) => entry.role.name),
      assignedApplications: assignedApplicationsCount,
      profile: detail.profile,
      assignedLoanOfficers: detail.assignedLoanOfficers,
    },
    organization: user.organization
      ? {
          id: user.organization.id,
          name: user.organization.name,
          type: user.organization.type,
          status: user.organization.status,
        }
      : null,
    branding,
  };
}

const CO_BROKER_SELF_EDITABLE_PROFILE_FIELDS = [
  "address",
  "website",
  "linkedinUrl",
  "preferredComm",
  "tollFree",
];

function mergeSelfEditableProfileData(existingProfileData = {}, fields = {}) {
  const next = { ...existingProfileData };

  for (const key of CO_BROKER_SELF_EDITABLE_PROFILE_FIELDS) {
    if (fields[key] === undefined) continue;
    const value = String(fields[key] ?? "").trim();
    if (value) {
      next[key] = value;
    } else {
      delete next[key];
    }
  }

  return next;
}

const subBrokerAuthInclude = {
  organization: true,
  roles: {
    include: {
      role: true,
    },
  },
  subBrokerProfile: true,
  subBrokerLoanOfficers: {
    include: {
      loanOfficer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profileImage: true,
        },
      },
    },
  },
};

module.exports = {
  PROFILE_JSON_FIELDS,
  CO_BROKER_SELF_EDITABLE_PROFILE_FIELDS,
  buildProfileDataFromFields,
  parseMultipartRequest,
  syncSubBrokerLoanOfficers,
  syncLoanOfficerSubBrokers,
  validateSubBrokerIds,
  formatAssignedLoanOfficers,
  formatAssignedSubBrokers,
  formatSubBrokerDetail,
  formatCoBrokerAuthResponse,
  mergeSelfEditableProfileData,
  subBrokerInclude,
  subBrokerAuthInclude,
  parseJsonField,
  parseBooleanField,
  resolvePrimaryContactFields,
  validatePrimaryContactFields,
};
