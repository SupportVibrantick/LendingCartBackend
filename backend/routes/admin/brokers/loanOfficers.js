const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");
const { adminLogs } = require("../../../services/logger/contextLogger.js");
const {
  sendLoanOfficerCredentialsEmail,
} = require("../../../services/emails/loanOfficerCredentialsEmail");
const {
  resolveClientDisplayNameFromData,
} = require("../../../services/messaging/resolveClientDisplayName");
const {
  buildApplicationSearchWhere,
  loanApplicationListInclude,
} = require("../../../services/applications/loanApplicationSearch");

function submissionFieldValue(fields, ...keys) {
  for (const field of fields || []) {
    const key = field.builderField?.fieldKey || field.fieldKey;
    if (!keys.includes(key)) continue;

    const raw = field.value;
    if (raw == null || raw === "") continue;

    if (typeof raw === "string") return raw.trim();
    if (typeof raw === "number") return String(raw);
    if (typeof raw === "object" && raw !== null) {
      if (typeof raw.value === "string" || typeof raw.value === "number") {
        return String(raw.value).trim();
      }
      return String(raw).trim();
    }

    return String(raw).trim();
  }

  return null;
}

function resolveAmountFromFields(fields) {
  const raw = submissionFieldValue(
    fields,
    "amountRequested",
    "loanAmount",
    "requestedAmount",
    "loan_amount",
  );

  if (!raw) return null;
  const amount = Number(String(raw).replace(/[,$]/g, ""));
  return Number.isNaN(amount) ? null : amount;
}

function formatLoanOfficerApplication(app) {
  const fields = app.submissions?.[0]?.fields || [];
  const amountRequested = app.amountRequested ?? resolveAmountFromFields(fields);

  return {
    applicationId: app.id,
    applicationNumber: app.applicationNumber,
    loanProductCode: app.loanProductCode,
    amountRequested: amountRequested != null ? Number(amountRequested) : null,
    status: app.status,
    createdAt: app.createdAt,
    borrowerName: resolveClientDisplayNameFromData(app.client, app.submissions),
    purpose:
      submissionFieldValue(fields, "purpose", "loanPurpose", "useOfFunds") ||
      app.purpose ||
      null,
  };
}

async function getBrokerOrg(prisma, orgId) {
  return prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, type: true, name: true },
  });
}

async function getBrokerLoanOfficer(prisma, orgId, userId) {
  return prisma.userAccount.findFirst({
    where: {
      id: userId,
      organizationId: orgId,
      isDeleted: false,
      roles: { some: { role: { name: "BROKER_OFFICER" } } },
    },
    include: {
      brokerProfile: true,
      _count: {
        select: { brokerLoanApplications: true },
      },
    },
  });
}

function normalizeWebsiteUrl(input) {
  if (!input?.trim()) return null;

  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://www.${url.replace(/^www\./i, "")}`;
  }

  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(/\/$/, "");
    return parsed.toString();
  } catch {
    return null;
  }
}

function formatLoanOfficer(user, assignedDeals = 0) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    assignedDeals,
    profile: user.brokerProfile || null,
  };
}

async function parseMultipartRequest(request) {
  const fields = {};
  let avatarPath = null;

  if (!request.isMultipart?.()) {
    return { fields: request.body || {}, avatarPath };
  }

  const parts = request.parts();

  for await (const part of parts) {
    if (part.type === "file") {
      if (part.fieldname !== "avatar") continue;

      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(part.mimetype)) {
        const error = new Error("Invalid image type. Only jpg, png, gif, webp allowed.");
        error.statusCode = 400;
        throw error;
      }

      const uploadDir = path.join(process.cwd(), "public/broker/loanofficer");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const fileName = `${Date.now()}-${part.filename.replace(/\s+/g, "_")}`;
      const filePath = path.join(uploadDir, fileName);
      await pipeline(part.file, fs.createWriteStream(filePath));
      avatarPath = `/public/broker/loanofficer/${fileName}`;
    } else {
      fields[part.fieldname] = part.value;
    }
  }

  return { fields, avatarPath };
}

function validateLoanOfficerPayload(fields, { isCreate }) {
  const {
    email,
    confirmEmail,
    password,
    confirmPassword,
    firstName,
    lastName,
  } = fields;

  if (!email?.trim() || !firstName?.trim() || !lastName?.trim()) {
    return "First name, last name and email are required";
  }

  if (isCreate) {
    if (!password?.trim() || !confirmPassword?.trim()) {
      return "Password and confirm password are required";
    }
    if (email !== confirmEmail) {
      return "Email and confirm email do not match";
    }
    if (password !== confirmPassword) {
      return "Password and confirm password do not match";
    }
  } else if (password || confirmPassword) {
    if (password !== confirmPassword) {
      return "Password and confirm password do not match";
    }
  }

  return null;
}

function buildProfileData(fields, avatarPath) {
  const website = normalizeWebsiteUrl(fields.website);

  return {
    company: fields.company?.trim() || null,
    tollFree: fields.tollFree?.trim() || null,
    tollFreeExt: fields.tollFreeExt?.trim() || null,
    serviceProvider: fields.serviceProvider?.trim() || null,
    address: fields.address?.trim() || null,
    suite: fields.suite?.trim() || null,
    city: fields.city?.trim() || null,
    state: fields.state?.trim() || null,
    zipCode: fields.zipCode?.trim() || null,
    agentType: fields.agentType?.trim() || null,
    licenseNumber: fields.licenseNumber?.trim() || null,
    preferredComm: fields.preferredComm?.trim() || null,
    website,
    ...(avatarPath ? { avatarUrl: avatarPath } : {}),
  };
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function brokerLoanOfficersRoutes(fastify) {
  fastify.get("/:orgId/:userId/applications", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId, userId } = request.params;
    const page = Math.max(parseInt(request.query?.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(request.query?.limit || "10", 10), 1), 50);
    const skip = (page - 1) * limit;
    const search = request.query?.search?.trim();

    try {
      const officer = await getBrokerLoanOfficer(prisma, orgId, userId);
      if (!officer) {
        return reply.status(404).send({ success: false, message: "Loan officer not found" });
      }

      const where = {
        brokerOrgId: orgId,
        brokerUserId: userId,
      };

      if (search) {
        where.OR = buildApplicationSearchWhere(search, { includeBorrower: true });
      }

      const [applications, total, amountAgg] = await prisma.$transaction([
        prisma.loanApplication.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: loanApplicationListInclude,
        }),
        prisma.loanApplication.count({ where }),
        prisma.loanApplication.aggregate({
          where,
          _sum: { amountRequested: true },
        }),
      ]);

      return reply.send({
        success: true,
        data: applications.map(formatLoanOfficerApplication),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(Math.ceil(total / limit), 1),
        },
        summary: {
          totalAmount:
            amountAgg._sum.amountRequested != null
              ? Number(amountAgg._sum.amountRequested)
              : 0,
        },
      });
    } catch (error) {
      adminLogs.error("List loan officer applications failed", { error, orgId, userId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to fetch applications",
      });
    }
  });

  fastify.get("/:orgId/:userId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId, userId } = request.params;

    try {
      const user = await getBrokerLoanOfficer(prisma, orgId, userId);
      if (!user) {
        return reply.status(404).send({ success: false, message: "Loan officer not found" });
      }

      return reply.send({
        success: true,
        data: formatLoanOfficer(user, user._count?.brokerLoanApplications || 0),
      });
    } catch (error) {
      adminLogs.error("Get broker loan officer failed", { error, orgId, userId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to fetch loan officer",
      });
    }
  });

  fastify.post("/:orgId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId } = request.params;

    try {
      const org = await getBrokerOrg(prisma, orgId);
      if (!org) {
        return reply.status(404).send({ success: false, message: "Broker not found" });
      }
      if (org.type !== "BROKER") {
        return reply.status(400).send({ success: false, message: "Organization is not a broker" });
      }

      const { fields, avatarPath } = await parseMultipartRequest(request);
      const validationError = validateLoanOfficerPayload(fields, { isCreate: true });
      if (validationError) {
        return reply.status(400).send({ success: false, message: validationError });
      }

      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        allowedToLogin,
      } = fields;

      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await prisma.userAccount.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      });

      if (existingUser && !existingUser.isDeleted) {
        return reply.status(409).send({ success: false, message: "Email already in use" });
      }

      const roleRecord = await prisma.role.findFirst({ where: { name: "BROKER_OFFICER" } });
      if (!roleRecord) {
        return reply.status(500).send({ success: false, message: "Role configuration error" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const status = allowedToLogin === "false" ? "DISABLED" : "ACTIVE";
      const profileData = buildProfileData(fields, avatarPath);

      const user = await prisma.$transaction(async (tx) => {
        let account;

        if (existingUser?.isDeleted) {
          account = await tx.userAccount.update({
            where: { id: existingUser.id },
            data: {
              email: normalizedEmail,
              passwordHash,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              phone: phone?.trim() || null,
              organizationId: orgId,
              status,
              isDeleted: false,
              deletedAt: null,
            },
          });

          await tx.userRole.deleteMany({ where: { userId: account.id } });
          await tx.userRole.create({
            data: { userId: account.id, roleId: roleRecord.id },
          });

          await tx.brokerUserProfile.upsert({
            where: { userId: account.id },
            create: { userId: account.id, ...profileData },
            update: profileData,
          });
        } else {
          account = await tx.userAccount.create({
            data: {
              organizationId: orgId,
              email: normalizedEmail,
              passwordHash,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              phone: phone?.trim() || null,
              status,
              roles: {
                create: { roleId: roleRecord.id },
              },
              brokerProfile: {
                create: profileData,
              },
            },
          });
        }

        return account;
      });

      if (user.status === "ACTIVE") {
        try {
          await sendLoanOfficerCredentialsEmail({
            firstName: user.firstName,
            email: user.email,
            password,
            organizationName: org.name,
            prisma: fastify.prisma,
          });
        } catch (mailErr) {
          adminLogs.error("Loan officer welcome email failed", {
            error: mailErr,
            userId: user.id,
          });
        }
      }

      adminLogs.info("Broker loan officer created", { orgId, userId: user.id });

      const created = await getBrokerLoanOfficer(prisma, orgId, user.id);

      return reply.status(201).send({
        success: true,
        message: "Loan officer created successfully",
        data: formatLoanOfficer(created, created?._count?.brokerLoanApplications || 0),
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      adminLogs.error("Create broker loan officer failed", { error, orgId });
      return reply.status(statusCode).send({
        success: false,
        message: error.message || "Failed to create loan officer",
      });
    }
  });

  fastify.patch("/:orgId/:userId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId, userId } = request.params;

    try {
      const existing = await getBrokerLoanOfficer(prisma, orgId, userId);
      if (!existing) {
        return reply.status(404).send({ success: false, message: "Loan officer not found" });
      }

      const { fields, avatarPath } = await parseMultipartRequest(request);
      const validationError = validateLoanOfficerPayload(fields, { isCreate: false });
      if (validationError) {
        return reply.status(400).send({ success: false, message: validationError });
      }

      const updateData = {};
      if (fields.firstName !== undefined) updateData.firstName = fields.firstName.trim();
      if (fields.lastName !== undefined) updateData.lastName = fields.lastName.trim();
      if (fields.phone !== undefined) updateData.phone = fields.phone?.trim() || null;

      if (fields.allowedToLogin !== undefined) {
        updateData.status = fields.allowedToLogin === "false" ? "DISABLED" : "ACTIVE";
      }

      if (fields.email !== undefined) {
        const normalizedEmail = fields.email.trim().toLowerCase();
        const duplicate = await prisma.userAccount.findFirst({
          where: {
            email: { equals: normalizedEmail, mode: "insensitive" },
            id: { not: userId },
            isDeleted: false,
          },
        });
        if (duplicate) {
          return reply.status(409).send({ success: false, message: "Email already in use" });
        }
        updateData.email = normalizedEmail;
      }

      if (fields.password?.trim()) {
        updateData.passwordHash = await bcrypt.hash(fields.password, 10);
      }

      const profileData = buildProfileData(fields, avatarPath);

      await prisma.$transaction(async (tx) => {
        if (Object.keys(updateData).length > 0) {
          await tx.userAccount.update({
            where: { id: userId },
            data: updateData,
          });
        }

        if (existing.brokerProfile) {
          await tx.brokerUserProfile.update({
            where: { userId },
            data: profileData,
          });
        } else {
          await tx.brokerUserProfile.create({
            data: {
              userId,
              ...profileData,
            },
          });
        }
      });

      const updated = await getBrokerLoanOfficer(prisma, orgId, userId);

      return reply.send({
        success: true,
        message: "Loan officer updated successfully",
        data: formatLoanOfficer(updated, updated?._count?.brokerLoanApplications || 0),
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      adminLogs.error("Update broker loan officer failed", { error, orgId, userId });
      return reply.status(statusCode).send({
        success: false,
        message: error.message || "Failed to update loan officer",
      });
    }
  });
}

module.exports = brokerLoanOfficersRoutes;
