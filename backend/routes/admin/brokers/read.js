const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { adminLogs } = require("../../../services/logger/contextLogger.js");

async function readBrokerRoutes(fastify) {
  // ----------------------------- //
  // GET / → List brokers
  // ----------------------------- //
  fastify.get("/", async (request, reply) => {
    try {
      const q = request.query || {};

      const page = Math.max(parseInt(q.page || "1", 10), 1);
      const limit = Math.min(Math.max(parseInt(q.limit || "20", 10), 1), 100);
      const skip = (page - 1) * limit;

      const where = { type: "BROKER" };

      if (q.name) where.name = { contains: q.name, mode: "insensitive" };
      if (q.email) where.email = { contains: q.email, mode: "insensitive" };
      if (q.phone) where.phone = { contains: q.phone };

      const allowedSortFields = new Set(["createdAt", "updatedAt", "name", "email"]);
      const sortBy = allowedSortFields.has(q.sortBy) ? q.sortBy : "createdAt";
      const sortOrder = q.sortOrder === "asc" ? "asc" : "desc";

      const total = await prisma.organization.count({ where });

      const brokers = await prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              users: true, // this is admins in our domain
              brokerLenderAccessAsBroker: true,
              affiliateLinks: true,
            },
          },
        },
      });

      // ---- Transform backend naming → frontend naming ----
      const cleaned = brokers.map((b) => ({
        ...b,
        adminCount: b._count.users,
        _count: undefined, // remove confusing prisma field
      }));

      const totalPages = Math.ceil(total / limit);

      return reply.status(200).send({
        success: true,
        message: "Brokers retrieved successfully",
        data: cleaned,
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      });
    } catch (error) {
      adminLogs.error("Failed to list brokers", { error });
      return reply.status(500).send({
        success: false,
        message: "Server error while fetching brokers",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

  // ----------------------------- //
  // GET /:id → Single broker with admins
  // ----------------------------- //
  fastify.get("/:id", async (request, reply) => {
    try {
      const { id } = request.params;

      const broker = await prisma.organization.findUnique({
        where: { id },
        include: {
          users: {
            // THESE ARE ADMINS
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 200,
          },

          brokerWhiteLabelSettings: true,
          affiliateLinks: true,
          brokerLenderAccessAsBroker: {
            select: { id: true, lenderOrgId: true, isActive: true, source: true },
            take: 200,
          },

          _count: {
            select: {
              users: true,
              affiliateLinks: true,
              brokerLenderAccessAsBroker: true,
            },
          },
        },
      });

      if (!broker) {
        return reply.status(404).send({
          success: false,
          message: "Broker organization not found",
        });
      }

      // ---- Transform for frontend clarity ----
      const cleaned = {
        id: broker.id,
        name: broker.name,
        email: broker.email,
        phone: broker.phone,
        status: broker.status,
        createdAt: broker.createdAt,
        updatedAt: broker.updatedAt,

        admins: broker.users, // <--- THE FIX

        affiliateLinks: broker.affiliateLinks,
        lenderAccess: broker.brokerLenderAccessAsBroker,
        whiteLabel: broker.brokerWhiteLabelSettings,

        counts: {
          admins: broker._count.users,
          affiliateLinks: broker._count.affiliateLinks,
          lenderAccess: broker._count.brokerLenderAccessAsBroker,
        },
      };

      return reply.status(200).send({
        success: true,
        message: "Broker retrieved successfully",
        data: cleaned,
      });
    } catch (error) {
      adminLogs.error("Failed to fetch broker by id", {
        error,
        id: request.params?.id,
      });

      return reply.status(500).send({
        success: false,
        message: "Server error while fetching broker",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });
}

module.exports = readBrokerRoutes;
