// routes/admin/lenders/list.js

const { adminLogs } = require("../../../services/logger/contextLogger.js");
const { findLenderAdminUser } = require("../../../utils/lender/findLenderAdminUser.js");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function listLendersRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "List lenders",
        description:
          "Returns paginated list of lender organizations with admin and broker details.",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            search: { type: "string" },
          },
        },
      },
    },

    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const page = Math.max(1, Number(request.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 20));
        const skip = (page - 1) * limit;

        const search = (request.query.search || "").trim();

        // -----------------------------
        // UUID DETECTION
        // -----------------------------

        const isUUID =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            search
          );

        // -----------------------------
        // WHERE FILTER
        // -----------------------------

        const where = {
          type: "LENDER",
          isDeleted: { not: true },

          ...(search && {
            OR: [
              ...(isUUID ? [{ id: search }] : []),

              { name: { contains: search, mode: "insensitive" } },

              { email: { contains: search, mode: "insensitive" } },

              { phone: { contains: search, mode: "insensitive" } },
            ],
          }),
        };

        // -----------------------------
        // FETCH DATA
        // -----------------------------

        const [total, lenders] = await Promise.all([
          prisma.organization.count({ where }),

          prisma.organization.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,

            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true,

              // BROKER ACCESS
              brokerLenderAccessAsLender: {
                where: { isActive: true },
                select: {
                  brokerOrgId: true,
                  broker: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
                take: 1,
              },
            },
          }),
        ]);

        // Bulk fetch admin users to avoid N+1 query
        const lenderOrgIds = lenders.map((org) => org.id);
        const adminRoles = await prisma.userRole.findMany({
          where: {
            role: { name: "LENDER_ADMIN" },
            user: {
              organizationId: { in: lenderOrgIds },
              isDeleted: { not: true },
              status: { in: ["ACTIVE", "INVITED"] },
            },
          },
          include: { user: true },
          orderBy: { user: { createdAt: "asc" } },
        });

        const adminMap = {};
        adminRoles.forEach((role) => {
          const orgId = role.user.organizationId;
          if (!adminMap[orgId]) {
            adminMap[orgId] = role.user;
          }
        });

        // -----------------------------
        // FORMAT RESPONSE
        // -----------------------------

        const results = lenders.map((org) => {
            const adminUser = adminMap[org.id] || null;
            const brokerAccess = org.brokerLenderAccessAsLender?.[0];

            return {
              id: org.id,

              organizationName: org.name,
              organizationEmail: org.email,
              organizationPhone: org.phone,
              organizationStatus: org.status,

              adminFirstName: adminUser?.firstName || null,
              adminLastName: adminUser?.lastName || null,
              adminEmail: adminUser?.email || null,
              adminPhone: adminUser?.phone || null,
              adminStatus: adminUser?.status || null,

              brokerOrgId: brokerAccess?.brokerOrgId || null,
              brokerName: brokerAccess?.broker?.name || null,

              createdAt: org.createdAt,
            };
        });

        return reply.send({
          success: true,
          data: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            results,
          },
        });
      } catch (error) {
        adminLogs.error("Failed to fetch lenders list", error);

        return reply.status(500).send({
          success: false,
          message: "Server error occurred while fetching lenders.",
          details:
            process.env.NODE_ENV === "development"
              ? error.message
              : undefined,
        });
      }
    }
  );
}

module.exports = listLendersRoutes;