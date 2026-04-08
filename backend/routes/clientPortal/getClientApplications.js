const jwt = require("jsonwebtoken");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function getClientApplicationsRoute(fastify) {
  fastify.get(
    "/applications",
    {
      schema: {
        tags: ["Client Portal"],
        summary: "Get all loan applications for logged-in client",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
            status: { type: "string" },
            search: { type: "string" }, // ✅ NEW
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ===============================
           AUTH
        =============================== */

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const token = authHeader.split(" ")[1];

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
          return reply.code(401).send({
            success: false,
            message: "Invalid token",
          });
        }

        if (!decoded.clientId || decoded.role !== "CLIENT") {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const clientId = decoded.clientId;

        /* ===============================
           PAGINATION
        =============================== */

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const skip = (page - 1) * limit;

        /* ===============================
           WHERE CLAUSE (UPDATED)
        =============================== */

        const where = {
          clientId,
        };

        // status filter
        if (req.query.status) {
          where.status = req.query.status;
        }

        // ✅ SEARCH FILTER (SAFE ADD)
        if (req.query.search) {
          where.OR = [
            {
              applicationNumber: {
                contains: req.query.search,
                mode: "insensitive",
              },
            },
            {
              status: {
                contains: req.query.search,
                mode: "insensitive",
              },
            },
          ];
        }

        /* ===============================
           FETCH
        =============================== */

        const [applications, total] = await Promise.all([
          prisma.loanApplication.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              applicationNumber: true,
              status: true,
              amountRequested: true,
              createdAt: true,

              documentRequirements: {
                select: { id: true },
              },

              documentUploads: {
                select: { id: true },
              },
            },
          }),

          prisma.loanApplication.count({ where }),
        ]);

        /* ===============================
           FORMAT RESPONSE
        =============================== */

        const formatted = applications.map((app) => ({
          id: app.id,
          applicationNumber: app.applicationNumber,
          status: app.status,
          amountRequested: app.amountRequested,
          createdAt: app.createdAt,

          documentProgress: {
            total: app.documentRequirements.length,
            uploaded: app.documentUploads.length,
          },
        }));

        /* ===============================
           RESPONSE
        =============================== */

        return reply.send({
          success: true,
          data: formatted,
          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        });

      } catch (error) {
        fastify.log.error(
          { error: error.message },
          "Failed to fetch client applications"
        );

        return reply.code(500).send({
          success: false,
          message: "Unexpected server error",
        });
      }
    }
  );
}

module.exports = getClientApplicationsRoute;