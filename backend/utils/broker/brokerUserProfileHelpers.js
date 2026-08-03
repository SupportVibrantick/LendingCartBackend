const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");
const {
  parseJsonField,
  parseBooleanField,
} = require("./subBrokerProfileHelpers");

const PROFILE_JSON_FIELDS = [
  "statesAuthorized",
  "companyStateLicenseStates",
  "personalStateLicenseStates",
  "branchIds",
];

const PROFILE_BOOLEAN_FIELDS = [
  "hasCompanyNmls",
  "hasPersonalNmls",
  "hasCompanyStateLicense",
  "hasPersonalStateLicense",
];

const PROFILE_SCALAR_FIELDS = [
  "findersFee",
  "ein",
  "dre",
  "companyNmls",
  "personalNmls",
  "companyStateLicense",
  "personalStateLicense",
  "permissionLevel",
];

function buildProfileDataFromFields(fields = {}, existing = {}) {
  const profileData =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};

  for (const key of PROFILE_SCALAR_FIELDS) {
    if (fields[key] !== undefined) {
      const value = String(fields[key] || "").trim();
      if (value) profileData[key] = value;
      else delete profileData[key];
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

  return profileData;
}

function mergeBrokerProfileResponse(brokerProfile) {
  if (!brokerProfile) return null;

  const profileData =
    brokerProfile.profileData &&
    typeof brokerProfile.profileData === "object" &&
    !Array.isArray(brokerProfile.profileData)
      ? brokerProfile.profileData
      : {};

  return {
    company: brokerProfile.company,
    tollFree: brokerProfile.tollFree,
    tollFreeExt: brokerProfile.tollFreeExt,
    serviceProvider: brokerProfile.serviceProvider,
    address: brokerProfile.address,
    suite: brokerProfile.suite,
    city: brokerProfile.city,
    state: brokerProfile.state,
    zipCode: brokerProfile.zipCode,
    agentType: brokerProfile.agentType,
    licenseNumber: brokerProfile.licenseNumber,
    preferredComm: brokerProfile.preferredComm,
    website: brokerProfile.website,
    avatarUrl: brokerProfile.avatarUrl,
    w9Url: brokerProfile.w9Url,
    createdAt: brokerProfile.createdAt,
    updatedAt: brokerProfile.updatedAt,
    ...profileData,
  };
}

async function saveBrokerUserFile(part, subdir) {
  const uploadDir = path.join(process.cwd(), `public/broker/${subdir}`);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const safeName = part.filename.replace(/\s+/g, "_");
  const fileName = `${Date.now()}-${safeName}`;
  const filePath = path.join(uploadDir, fileName);

  await pipeline(part.file, fs.createWriteStream(filePath));

  return `/public/broker/${subdir}/${fileName}`;
}

async function parseBrokerUserMultipart(req) {
  const contentType = req.headers["content-type"] || "";

  if (!contentType.includes("multipart/form-data")) {
    return {
      fields: { ...req.body },
      avatarUrl: null,
      w9Url: null,
    };
  }

  const fields = {};
  let avatarUrl = null;
  let w9Url = null;

  const parts = req.parts();

  for await (const part of parts) {
    if (part.type === "file") {
      if (part.fieldname === "avatar") {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(part.mimetype)) {
          throw new Error("Invalid image type. Only jpg, png, webp allowed.");
        }
        avatarUrl = await saveBrokerUserFile(part, "loanofficer");
      }

      if (part.fieldname === "w9") {
        const allowedTypes = [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
        ];
        if (!allowedTypes.includes(part.mimetype)) {
          throw new Error("Invalid W9 file type. Only pdf or images allowed.");
        }
        w9Url = await saveBrokerUserFile(part, "loanofficer-w9");
      }
      continue;
    }

    fields[part.fieldname] = part.value;
  }

  return { fields, avatarUrl, w9Url };
}

async function syncUserPermissions(prisma, userId, permissionKeys = []) {
  const {
    normalizeLoanOfficerPermissions,
  } = require("./loanOfficerPermissions");

  const uniqueKeys = normalizeLoanOfficerPermissions(
    [...new Set((permissionKeys || []).filter(Boolean))],
  );

  await prisma.userPermission.deleteMany({
    where: { userId },
  });

  if (uniqueKeys.length === 0) return;

  const permissionRecords = await prisma.permission.findMany({
    where: { key: { in: uniqueKeys } },
  });

  if (permissionRecords.length === 0) return;

  await prisma.userPermission.createMany({
    data: permissionRecords.map((perm) => ({
      userId,
      permissionId: perm.id,
      isAllowed: true,
    })),
  });
}

function parsePermissionsField(fields = {}) {
  if (!fields.permissions) return [];
  try {
    const parsed = JSON.parse(fields.permissions);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error("Invalid permissions format");
  }
}

function deletePublicFileIfExists(publicPath) {
  if (!publicPath) return;
  const diskPath = path.join(process.cwd(), publicPath);
  if (fs.existsSync(diskPath)) {
    fs.unlinkSync(diskPath);
  }
}

module.exports = {
  buildProfileDataFromFields,
  mergeBrokerProfileResponse,
  parseBrokerUserMultipart,
  syncUserPermissions,
  parsePermissionsField,
  deletePublicFileIfExists,
};
