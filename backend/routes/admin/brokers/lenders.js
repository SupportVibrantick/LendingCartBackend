const { adminLogs } = require("../../../services/logger/contextLogger.js");

async function getBrokerOrg(prisma, orgId) {
  return prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, type: true, name: true },
  });
}

function formatLenderAccess(row) {
  return {
    id: row.id,
    lenderOrgId: row.lenderOrgId,
    brokerOrgId: row.brokerOrgId,
    source: row.source,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lender: row.lender,
  };
}

function formatLoanTypeLabel(value) {
  if (!value) return "";
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLenderAccessDetail(row) {
  const lender = row.lender;
  const admin = lender?.users?.[0] || null;
  const profile = lender?.lenderProfile || null;

  return {
    id: row.id,
    lenderOrgId: row.lenderOrgId,
    brokerOrgId: row.brokerOrgId,
    source: row.source,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lender: lender
      ? {
          id: lender.id,
          name: lender.name,
          email: lender.email,
          phone: lender.phone,
          status: lender.status,
          createdAt: lender.createdAt,
          updatedAt: lender.updatedAt,
        }
      : null,
    admin: admin
      ? {
          id: admin.id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          phone: admin.phone,
          status: admin.status,
          lastLoginAt: admin.lastLoginAt,
          createdAt: admin.createdAt,
        }
      : null,
    profile: profile
      ? {
          summary: profile.summary,
          loanTypes: Array.isArray(profile.loanTypes)
            ? profile.loanTypes.map(formatLoanTypeLabel)
            : [],
          minFunding: profile.minFunding != null ? Number(profile.minFunding) : null,
          maxFunding: profile.maxFunding != null ? Number(profile.maxFunding) : null,
          statesSupported: profile.statesSupported,
          industries: profile.industries,
          fundingSpeedDays: profile.fundingSpeedDays,
          profileStatus: profile.profileStatus,
          isVisible: profile.isVisible,
        }
      : null,
    counts: {
      loanProducts: lender?._count?.lenderProducts ?? 0,
      activeBrokerConnections: lender?._count?.brokerLenderAccessAsLender ?? 0,
    },
  };
}

const lenderDetailInclude = {
  lender: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lenderProfile: true,
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
        take: 1,
      },
      _count: {
        select: {
          lenderProducts: true,
          brokerLenderAccessAsLender: { where: { isActive: true } },
        },
      },
    },
  },
};

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function adminBrokerLendersRoutes(fastify) {
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

      const where = { brokerOrgId: orgId };

      if (search) {
        where.OR = [
          { lender: { name: { contains: search, mode: "insensitive" } } },
          { lender: { email: { contains: search, mode: "insensitive" } } },
          { lender: { phone: { contains: search, mode: "insensitive" } } },
        ];
      }

      const [rows, total] = await prisma.$transaction([
        prisma.brokerLenderAccess.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            lender: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        }),
        prisma.brokerLenderAccess.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: rows.map(formatLenderAccess),
        meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
      });
    } catch (error) {
      adminLogs.error("List broker lenders failed", { error, orgId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to list lenders",
      });
    }
  });

  fastify.post("/:orgId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId } = request.params;
    const { lenderOrgId } = request.body || {};

    try {
      const org = await getBrokerOrg(prisma, orgId);
      if (!org) {
        return reply.status(404).send({ success: false, message: "Broker not found" });
      }
      if (org.type !== "BROKER") {
        return reply.status(400).send({ success: false, message: "Organization is not a broker" });
      }
      if (!lenderOrgId?.trim()) {
        return reply.status(400).send({ success: false, message: "Lender is required" });
      }

      const lender = await prisma.organization.findFirst({
        where: {
          id: lenderOrgId.trim(),
          type: "LENDER",
          isDeleted: { not: true },
        },
        select: { id: true, name: true },
      });

      if (!lender) {
        return reply.status(404).send({ success: false, message: "Lender not found" });
      }

      const existing = await prisma.brokerLenderAccess.findFirst({
        where: { brokerOrgId: orgId, lenderOrgId: lender.id },
      });

      let access;
      if (existing) {
        access = await prisma.brokerLenderAccess.update({
          where: { id: existing.id },
          data: { isActive: true },
          include: {
            lender: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        });
      } else {
        access = await prisma.brokerLenderAccess.create({
          data: {
            brokerOrgId: orgId,
            lenderOrgId: lender.id,
            source: "PLATFORM_DEFAULT",
            isActive: true,
          },
          include: {
            lender: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        });
      }

      return reply.status(201).send({
        success: true,
        data: formatLenderAccess(access),
        message: existing ? "Lender connection reactivated" : "Lender assigned successfully",
      });
    } catch (error) {
      adminLogs.error("Assign broker lender failed", { error, orgId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to assign lender",
      });
    }
  });

  fastify.get("/:orgId/:accessId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId, accessId } = request.params;

    try {
      const org = await getBrokerOrg(prisma, orgId);
      if (!org) {
        return reply.status(404).send({ success: false, message: "Broker not found" });
      }
      if (org.type !== "BROKER") {
        return reply.status(400).send({ success: false, message: "Organization is not a broker" });
      }

      const access = await prisma.brokerLenderAccess.findFirst({
        where: { id: accessId, brokerOrgId: orgId },
        include: lenderDetailInclude,
      });

      if (!access) {
        return reply.status(404).send({ success: false, message: "Lender connection not found" });
      }

      return reply.send({
        success: true,
        data: formatLenderAccessDetail(access),
      });
    } catch (error) {
      adminLogs.error("Get broker lender detail failed", { error, orgId, accessId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to load lender details",
      });
    }
  });

  fastify.patch("/:orgId/:accessId/status", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId, accessId } = request.params;
    const { isActive } = request.body || {};

    try {
      if (typeof isActive !== "boolean") {
        return reply.status(400).send({ success: false, message: "isActive must be a boolean" });
      }

      const access = await prisma.brokerLenderAccess.findFirst({
        where: { id: accessId, brokerOrgId: orgId },
      });

      if (!access) {
        return reply.status(404).send({ success: false, message: "Lender connection not found" });
      }

      const updated = await prisma.brokerLenderAccess.update({
        where: { id: accessId },
        data: { isActive },
        include: {
          lender: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      return reply.send({
        success: true,
        data: formatLenderAccess(updated),
      });
    } catch (error) {
      adminLogs.error("Update broker lender status failed", { error, orgId, accessId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to update lender connection",
      });
    }
  });

  fastify.delete("/:orgId/:accessId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId, accessId } = request.params;

    try {
      const access = await prisma.brokerLenderAccess.findFirst({
        where: { id: accessId, brokerOrgId: orgId },
      });

      if (!access) {
        return reply.status(404).send({ success: false, message: "Lender connection not found" });
      }

      await prisma.brokerLenderAccess.delete({ where: { id: accessId } });

      return reply.send({
        success: true,
        message: "Lender removed from broker",
      });
    } catch (error) {
      adminLogs.error("Remove broker lender failed", { error, orgId, accessId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to remove lender",
      });
    }
  });
}

module.exports = adminBrokerLendersRoutes;
