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
            search: { type: "string" },
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
           BASE WHERE
        =============================== */

        const baseWhere = {
          clientId,
          ...(req.query.status && { status: req.query.status }),
        };

        /* ===============================
           FETCH APPLICATIONS (IMPORTANT FIX)
        =============================== */

        let applications = await prisma.loanApplication.findMany({
          where: baseWhere,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            applicationNumber: true,
            status: true,
            amountRequested: true,
            loanProductCode: true,
            createdAt: true,

            // ✅ FIX: get latest submission
            submissions: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                fields: true,
              },
            },

            documentRequirements: {
              select: { id: true },
            },

            documentUploads: {
              select: { id: true },
            },
          },
        });

        /* ===============================
           SEARCH (ENHANCED)
        =============================== */

        if (req.query.search) {
          const search = req.query.search.toLowerCase().trim();

          applications = applications.filter((app) => {
            const latestSubmission = app.submissions?.[0];

            const getFieldValue = (key) => {
              const field = latestSubmission?.fields?.find(
                (f) => f.fieldKey === key
              );
              return field?.value || "";
            };

            const applicationNumber = String(app.applicationNumber || "").toLowerCase();
            const status = String(app.status || "").toLowerCase();
            const amount =
              String(getFieldValue("amountRequested") || app.amountRequested || "").toLowerCase();

            return (
              applicationNumber.includes(search) ||
              status.includes(search) ||
              amount.includes(search)
            );
          });
        }

        /* ===============================
           TOTAL
        =============================== */

        const total = applications.length;

        /* ===============================
           FORMAT RESPONSE (FINAL FIX)
        =============================== */

        const formatted = applications.map((app) => {
          const latestSubmission = app.submissions?.[0];

          const getFieldValue = (key) => {
            const field = latestSubmission?.fields?.find(
              (f) => f.fieldKey === key
            );
            return field?.value || null;
          };

          const amountFromField = getFieldValue("amountRequested");
          const productFromField = getFieldValue("loanProductCode");

          return {
            id: app.id,
            applicationNumber: app.applicationNumber,
            status: app.status,

            // ✅ Priority: submission > root
            loanProduct: productFromField || app.loanProductCode || null,

            amountRequested: amountFromField
              ? Number(amountFromField).toLocaleString("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                })
              : app.amountRequested
              ? Number(app.amountRequested).toLocaleString("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                })
              : null,

            createdAt: app.createdAt,

            documentProgress: {
              total: app.documentRequirements.length,
              uploaded: app.documentUploads.length,
            },
          };
        });

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