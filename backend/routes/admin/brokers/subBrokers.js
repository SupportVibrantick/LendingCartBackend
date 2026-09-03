const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { adminLogs } = require("../../../services/logger/contextLogger.js");
const {
  sendSubBrokerCredentialsEmail,
} = require("../../../services/emails/subBrokerCredentialsEmail");
const {
  resolveClientDisplayNameFromData,
} = require("../../../services/messaging/resolveClientDisplayName");
const {
  buildApplicationSearchWhere,
  loanApplicationListInclude,
} = require("../../../services/applications/loanApplicationSearch");
const {
  parseMultipartRequest,
  buildProfileDataFromFields,
  validatePrimaryContactFields,
  syncSubBrokerLoanOfficers,
  formatSubBrokerDetail,
  parseJsonField,
  subBrokerInclude,
} = require("../../../utils/broker/subBrokerProfileHelpers");

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

function formatSubBrokerApplication(app) {
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

function buildFreedDeletedEmail(user) {
  const at = user.email.lastIndexOf("@");
  if (at === -1) {
    return `${user.id.replace(/-/g, "")}.deleted@removed.local`;
  }

  const local = user.email.slice(0, at);
  const domain = user.email.slice(at + 1);
  return `${local}+deleted.${user.id.slice(0, 8)}.${Date.now()}@${domain}`;
}

function formatSubBrokerListItem(user, assignedApplications = 0) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    assignedApplications,
  };
}

async function getBrokerOrg(prisma, orgId) {
  return prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, type: true, name: true },
  });
}

async function getBrokerSubBroker(prisma, orgId, userId) {
  return prisma.userAccount.findFirst({
    where: {
      id: userId,
      organizationId: orgId,
      isDeleted: false,
      roles: { some: { role: { name: "SUB_BROKER" } } },
    },
    include: {
      ...subBrokerInclude,
      _count: { select: { assignedApplications: true } },
    },
  });
}

function validateCreateFields(fields) {
  if (!fields.agentType) return { error: "Agent type is required" };

  const contactValidation = validatePrimaryContactFields(fields);
  if (contactValidation.error) {
    return { error: contactValidation.error };
  }

  const allowedToLogin =
    fields.allowedToLogin === true ||
    fields.allowedToLogin === "true" ||
    fields.allowedToLogin === "1";
  const password = String(fields.password || "");
  const confirmPassword = String(fields.confirmPassword || password);

  if (allowedToLogin) {
    if (!password) return { error: "Password is required when login is enabled" };
    if (password.length < 8) return { error: "Password must be at least 8 characters" };
    if (password !== confirmPassword) return { error: "Passwords do not match" };
  }

  const { account } = contactValidation;

  return {
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    phone: account.phone,
    password: allowedToLogin ? password : crypto.randomBytes(16).toString("hex"),
    allowedToLogin,
  };
}

async function sendWelcomeEmail(fastify, prisma, {
  brokerOrgId,
  firstName,
  email,
  password,
  subBrokerId,
}) {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: brokerOrgId },
      select: { name: true },
    });

    await sendSubBrokerCredentialsEmail({
      firstName,
      email,
      password,
      organizationName: organization?.name,
      prisma: fastify.prisma,
    });

    fastify.log.info({ to: email, subBrokerId }, "Sub broker welcome email sent (admin)");
  } catch (mailErr) {
    fastify.log.error(
      { error: mailErr.message, to: email, subBrokerId },
      "Sub broker created but welcome email failed (admin)",
    );
  }
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function adminBrokerSubBrokersRoutes(fastify) {
  fastify.get("/:orgId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId } = request.params;
    const q = request.query || {};

    try {
      const org = await getBrokerOrg(prisma, orgId);
      if (!org) {
        return reply.status(404).send({ success: false, message: "Broker not found" });
      }
      if (org.type !== "BROKER") {
        return reply.status(400).send({ success: false, message: "Organization is not a broker" });
      }

      const page = Math.max(parseInt(q.page || "1", 10), 1);
      const limit = Math.min(Math.max(parseInt(q.limit || "10", 10), 1), 100);
      const skip = (page - 1) * limit;
      const search = q.search?.trim();

      const where = {
        organizationId: orgId,
        isDeleted: false,
        roles: { some: { role: { name: "SUB_BROKER" } } },
      };

      if (search) {
        where.OR = [
          { email: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ];
      }

      const [rows, total] = await prisma.$transaction([
        prisma.userAccount.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
            _count: { select: { assignedApplications: true } },
          },
        }),
        prisma.userAccount.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: rows.map((row) =>
          formatSubBrokerListItem(row, row._count.assignedApplications),
        ),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      adminLogs.error("List broker sub-brokers failed", { error, orgId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to list sub-brokers",
      });
    }
  });

  // Must register before /:orgId/:userId
  fastify.get("/:orgId/loan-officers", async (request, reply) => {
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

      const officers = await prisma.userAccount.findMany({
        where: {
          organizationId: orgId,
          isDeleted: false,
          status: "ACTIVE",
          roles: {
            some: {
              role: { name: "BROKER_OFFICER" },
            },
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          profileImage: true,
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      });

      return reply.send({
        success: true,
        data: officers,
      });
    } catch (error) {
      adminLogs.error("List broker sub-broker loan officers failed", { error, orgId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to list loan officers",
      });
    }
  });

  fastify.get("/:orgId/:userId/applications", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId, userId } = request.params;
    const page = Math.max(parseInt(request.query?.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(request.query?.limit || "10", 10), 1), 50);
    const skip = (page - 1) * limit;
    const search = request.query?.search?.trim();

    try {
      const subBroker = await getBrokerSubBroker(prisma, orgId, userId);
      if (!subBroker) {
        return reply.status(404).send({ success: false, message: "Sub-broker not found" });
      }

      const where = {
        brokerOrgId: orgId,
        subBrokerAssignments: {
          some: { subBrokerId: userId },
        },
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
        data: applications.map(formatSubBrokerApplication),
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
      adminLogs.error("List sub-broker applications failed", { error, orgId, userId });
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
      const user = await getBrokerSubBroker(prisma, orgId, userId);
      if (!user) {
        return reply.status(404).send({ success: false, message: "Sub-broker not found" });
      }

      return reply.send({
        success: true,
        data: {
          ...formatSubBrokerDetail(
            user,
            user.subBrokerProfile,
            user.subBrokerLoanOfficers || [],
          ),
          assignedApplications: user._count?.assignedApplications || 0,
        },
      });
    } catch (error) {
      adminLogs.error("Get broker sub-broker failed", { error, orgId, userId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to fetch sub-broker",
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

      let fields;
      let logoUrl;
      let w9Url;
      try {
        ({ fields, logoUrl, w9Url } = await parseMultipartRequest(request));
      } catch (uploadErr) {
        return reply.status(400).send({
          success: false,
          message: uploadErr.message || "Invalid upload",
        });
      }

      const validation = validateCreateFields(fields);
      if (validation.error) {
        return reply.status(400).send({ success: false, message: validation.error });
      }

      const {
        email,
        firstName,
        lastName,
        phone,
        password,
        allowedToLogin,
      } = validation;

      const assignedLoanOfficerIds = parseJsonField(
        fields.assignedLoanOfficerIds,
        [],
      );
      const adminUserId = request.user?.id || request.user?.userId || null;

      const existingUser = await prisma.userAccount.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        include: { roles: { include: { role: true } } },
      });

      if (existingUser && !existingUser.isDeleted) {
        return reply.status(409).send({ success: false, message: "Email already exists" });
      }

      const role = await prisma.role.findFirst({ where: { name: "SUB_BROKER" } });
      if (!role) {
        return reply.status(500).send({ success: false, message: "SUB_BROKER role not found" });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      let user;

      if (existingUser?.isDeleted) {
        const isSameOrgSubBroker =
          existingUser.organizationId === orgId &&
          existingUser.roles.some((entry) => entry.role.name === "SUB_BROKER");

        if (isSameOrgSubBroker) {
          user = await prisma.userAccount.update({
            where: { id: existingUser.id },
            data: {
              email,
              passwordHash: hashedPassword,
              firstName,
              lastName,
              phone,
              organizationId: orgId,
              createdById: adminUserId,
              isDeleted: false,
              deletedAt: null,
              status: "ACTIVE",
            },
          });
        } else {
          await prisma.userAccount.update({
            where: { id: existingUser.id },
            data: { email: buildFreedDeletedEmail(existingUser) },
          });

          user = await prisma.userAccount.create({
            data: {
              email,
              passwordHash: hashedPassword,
              firstName,
              lastName,
              phone,
              organizationId: orgId,
              createdById: adminUserId,
              roles: { create: { roleId: role.id } },
            },
          });
        }
      } else {
        user = await prisma.userAccount.create({
          data: {
            email,
            passwordHash: hashedPassword,
            firstName,
            lastName,
            phone,
            organizationId: orgId,
            createdById: adminUserId,
            roles: { create: { roleId: role.id } },
          },
        });
      }

      const profileData = buildProfileDataFromFields(fields);
      profileData.allowedToLogin = allowedToLogin;

      await prisma.subBrokerProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          profileData,
          logoUrl,
          w9Url,
        },
        update: {
          profileData,
          ...(logoUrl ? { logoUrl } : {}),
          ...(w9Url ? { w9Url } : {}),
        },
      });

      await syncSubBrokerLoanOfficers(
        prisma,
        user.id,
        assignedLoanOfficerIds,
        orgId,
      );

      if (allowedToLogin) {
        await sendWelcomeEmail(fastify, prisma, {
          brokerOrgId: orgId,
          firstName,
          email,
          password,
          subBrokerId: user.id,
        });
      }

      const detail = await getBrokerSubBroker(prisma, orgId, user.id);

      return reply.send({
        success: true,
        message: "Sub-broker created successfully",
        data: formatSubBrokerDetail(
          detail,
          detail.subBrokerProfile,
          detail.subBrokerLoanOfficers || [],
        ),
      });
    } catch (error) {
      adminLogs.error("Create broker sub-broker failed", { error, orgId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to create sub-broker",
      });
    }
  });

  fastify.patch("/:orgId/:userId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId, userId } = request.params;

    try {
      const existingUser = await getBrokerSubBroker(prisma, orgId, userId);
      if (!existingUser) {
        return reply.status(404).send({ success: false, message: "Sub-broker not found" });
      }

      let fields;
      let logoUrl;
      let w9Url;
      try {
        ({ fields, logoUrl, w9Url } = await parseMultipartRequest(request));
      } catch (uploadErr) {
        return reply.status(400).send({
          success: false,
          message: uploadErr.message || "Invalid upload",
        });
      }

      const contactValidation = validatePrimaryContactFields(fields);
      if (contactValidation.error) {
        return reply.status(400).send({
          success: false,
          message: contactValidation.error,
        });
      }

      const { account } = contactValidation;
      const updateData = {
        firstName: account.firstName,
        lastName: account.lastName,
        phone: account.phone,
      };

      if (fields.password) {
        if (String(fields.password).length < 8) {
          return reply.status(400).send({
            success: false,
            message: "Password must be at least 8 characters",
          });
        }
        updateData.passwordHash = await bcrypt.hash(fields.password, 12);
      }

      await prisma.userAccount.update({
        where: { id: userId },
        data: updateData,
      });

      const profileData = buildProfileDataFromFields(fields);
      const mergedProfileData = {
        ...(existingUser.subBrokerProfile?.profileData || {}),
        ...profileData,
      };

      await prisma.subBrokerProfile.upsert({
        where: { userId },
        create: {
          userId,
          profileData: mergedProfileData,
          logoUrl,
          w9Url,
        },
        update: {
          profileData: mergedProfileData,
          ...(logoUrl ? { logoUrl } : {}),
          ...(w9Url ? { w9Url } : {}),
        },
      });

      if (fields.assignedLoanOfficerIds !== undefined) {
        const assignedLoanOfficerIds = parseJsonField(
          fields.assignedLoanOfficerIds,
          [],
        );
        await syncSubBrokerLoanOfficers(
          prisma,
          userId,
          assignedLoanOfficerIds,
          orgId,
        );
      }

      const detail = await getBrokerSubBroker(prisma, orgId, userId);

      const passwordWasUpdated = Boolean(fields.password);
      if (passwordWasUpdated && detail?.status === "ACTIVE") {
        try {
          const organization = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { name: true },
          });

          await sendSubBrokerCredentialsEmail({
            firstName: detail.firstName,
            email: detail.email,
            password: String(fields.password),
            organizationName: organization?.name,
            prisma,
            isPasswordReset: true,
          });
        } catch (mailErr) {
          adminLogs.error("Sub-broker updated but password-reset email failed", {
            error: mailErr,
            orgId,
            userId,
          });
        }
      }

      return reply.send({
        success: true,
        message: "Sub-broker updated successfully",
        data: formatSubBrokerDetail(
          detail,
          detail.subBrokerProfile,
          detail.subBrokerLoanOfficers || [],
        ),
      });
    } catch (error) {
      adminLogs.error("Update broker sub-broker failed", { error, orgId, userId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to update sub-broker",
      });
    }
  });

  fastify.patch("/:orgId/:userId/status", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId, userId } = request.params;
    const { status } = request.body || {};

    try {
      if (!["ACTIVE", "DISABLED", "INVITED"].includes(status)) {
        return reply.status(400).send({ success: false, message: "Invalid status" });
      }

      const user = await getBrokerSubBroker(prisma, orgId, userId);
      if (!user) {
        return reply.status(404).send({ success: false, message: "Sub-broker not found" });
      }

      const updated = await prisma.userAccount.update({
        where: { id: userId },
        data: { status },
      });

      return reply.send({
        success: true,
        message: "Sub-broker status updated",
        data: { id: updated.id, status: updated.status },
      });
    } catch (error) {
      adminLogs.error("Update broker sub-broker status failed", { error, orgId, userId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to update status",
      });
    }
  });

  fastify.delete("/:orgId/:userId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId, userId } = request.params;

    try {
      const user = await getBrokerSubBroker(prisma, orgId, userId);
      if (!user) {
        return reply.status(404).send({ success: false, message: "Sub-broker not found" });
      }

      await prisma.userAccount.update({
        where: { id: userId },
        data: { isDeleted: true, deletedAt: new Date(), status: "DISABLED" },
      });

      return reply.send({ success: true, message: "Sub-broker removed" });
    } catch (error) {
      adminLogs.error("Delete broker sub-broker failed", { error, orgId, userId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to delete sub-broker",
      });
    }
  });
}

module.exports = adminBrokerSubBrokersRoutes;
