const bcrypt = require("bcrypt");
const { adminLogs } = require("../../../services/logger/contextLogger.js");
const {
  sendSubBrokerCredentialsEmail,
} = require("../../../services/subBrokerCredentialsEmail");
const {
  resolveClientDisplayNameFromData,
} = require("../../../services/resolveClientDisplayName");
const {
  buildApplicationSearchWhere,
  loanApplicationListInclude,
} = require("../../../services/loanApplicationSearch");

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

function formatSubBroker(user, assignedApplications = 0) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
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
      _count: { select: { assignedApplications: true } },
    },
  });
}

function validateSubBrokerCreate(body) {
  const { email, password, firstName, lastName, phone } = body || {};

  if (!email?.trim()) return "Email is required";
  if (!firstName?.trim()) return "First name is required";
  if (firstName.trim().length < 2) return "First name must be at least 2 characters";
  if (!lastName?.trim()) return "Last name is required";

  const cleanPhone = String(phone || "").replace(/\D/g, "");
  if (!cleanPhone) return "Phone is required";
  if (cleanPhone.length < 10) return "Enter a valid 10-digit phone number";

  if (!password?.trim()) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";

  return null;
}

function validateSubBrokerUpdate(body) {
  const { firstName, lastName, phone } = body || {};

  if (firstName !== undefined) {
    if (!firstName?.trim()) return "First name is required";
    if (firstName.trim().length < 2) return "First name must be at least 2 characters";
  }

  if (lastName !== undefined && !lastName?.trim()) {
    return "Last name is required";
  }

  if (phone !== undefined) {
    const cleanPhone = String(phone).replace(/\D/g, "");
    if (!cleanPhone) return "Phone is required";
    if (cleanPhone.length < 10) return "Enter a valid 10-digit phone number";
  }

  return null;
}

async function sendWelcomeEmail(fastify, prisma, { brokerOrgId, firstName, email, password, subBrokerId }) {
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
          formatSubBroker(row, row._count.assignedApplications),
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
        data: formatSubBroker(user, user._count?.assignedApplications || 0),
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
    const body = request.body || {};

    try {
      const org = await getBrokerOrg(prisma, orgId);
      if (!org) {
        return reply.status(404).send({ success: false, message: "Broker not found" });
      }
      if (org.type !== "BROKER") {
        return reply.status(400).send({ success: false, message: "Organization is not a broker" });
      }

      const validationError = validateSubBrokerCreate(body);
      if (validationError) {
        return reply.status(400).send({ success: false, message: validationError });
      }

      const email = body.email.trim().toLowerCase();
      const { password, firstName, lastName, phone } = body;
      const cleanPhone = String(phone).replace(/\D/g, "");
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

      const hashedPassword = await bcrypt.hash(password, 10);
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
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              phone: cleanPhone,
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
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              phone: cleanPhone,
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
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: cleanPhone,
            organizationId: orgId,
            createdById: adminUserId,
            roles: { create: { roleId: role.id } },
          },
        });
      }

      await sendWelcomeEmail(fastify, prisma, {
        brokerOrgId: orgId,
        firstName: firstName.trim(),
        email,
        password,
        subBrokerId: user.id,
      });

      return reply.send({
        success: true,
        message: "Sub-broker created successfully",
        data: formatSubBroker(user, 0),
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
    const body = request.body || {};

    try {
      const validationError = validateSubBrokerUpdate(body);
      if (validationError) {
        return reply.status(400).send({ success: false, message: validationError });
      }

      const existingUser = await getBrokerSubBroker(prisma, orgId, userId);
      if (!existingUser) {
        return reply.status(404).send({ success: false, message: "Sub-broker not found" });
      }

      const updateData = {};
      if (body.firstName !== undefined) updateData.firstName = body.firstName.trim();
      if (body.lastName !== undefined) updateData.lastName = body.lastName.trim();
      if (body.phone !== undefined) updateData.phone = String(body.phone).replace(/\D/g, "");

      const updated = await prisma.userAccount.update({
        where: { id: userId },
        data: updateData,
        include: { _count: { select: { assignedApplications: true } } },
      });

      return reply.send({
        success: true,
        message: "Sub-broker updated successfully",
        data: formatSubBroker(updated, updated._count.assignedApplications),
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
