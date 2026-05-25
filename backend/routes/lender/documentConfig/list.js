/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listLenderDocumentConfigRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender -> Document Config"],
        summary: "List lender document configs (with filters + pagination)",
        querystring: {
          type: "object",
          properties: {
            lenderProductId: { type: "string", format: "uuid" },
            loanProductCode: { type: "string" },
            search: { type: "string" },

            isRequired: { type: "boolean" },
            isCustom: { type: "boolean" },

            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= AUTH ================= */
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;

        /* ================= QUERY ================= */
        let {
          lenderProductId,
          loanProductCode,
          search,
          isRequired,
          isCustom,
          page = 1,
          limit = 10,
        } = req.query;

        page = Number(page);
        limit = Number(limit);

        const skip = (page - 1) * limit;

        /* ================= BASE WHERE ================= */
        const where = {
          lenderProduct: {
            lenderOrgId, // 🔥 CRITICAL SECURITY FILTER
            isActive: true,
          },
        };

        /* ================= FILTERS ================= */

        if (lenderProductId) {
          where.lenderProductId = lenderProductId;
        }

        if (loanProductCode) {
          where.lenderProduct = {
            ...where.lenderProduct,
            loanProductCode,
          };
        }

        if (typeof isRequired === "boolean") {
          where.isRequired = isRequired;
        }

        if (typeof isCustom === "boolean") {
          where.documentType = {
            isCustom,
          };
        }

        if (search) {
          where.documentType = {
            ...(where.documentType || {}),
            name: {
              contains: search,
              mode: "insensitive",
            },
          };
        }

        /* ================= FETCH ================= */
        const [docs, total] = await Promise.all([
          prisma.lenderDocumentRequirement.findMany({
            where,
            include: {
              documentType: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  isCustom: true,
                  description: true,
                },
              },
              lenderProduct: {
                select: {
                  id: true,
                  loanProductCode: true,
                },
              },
            },
            orderBy: [
              { sortOrder: "asc" },
              { createdAt: "asc" },
            ],
            skip,
            take: limit,
          }),

          prisma.lenderDocumentRequirement.count({ where }),
        ]);

        /* ================= FORMAT ================= */
        const formatted = docs.map((doc) => ({
          id: doc.id,

          // PRODUCT INFO
          lenderProductId: doc.lenderProductId,
          loanProductCode: doc.lenderProduct?.loanProductCode || null,

          // DOCUMENT INFO
          documentTypeId: doc.documentTypeId,
          documentName: doc.documentType?.name || null,
          documentCode: doc.documentType?.code || null,
          isCustom: doc.documentType?.isCustom || false,
          description: doc.documentType?.description || null,

          // CONFIG
          isRequired: doc.isRequired,
          minFiles: doc.minFiles,
          maxFiles: doc.maxFiles,
          notes: doc.notes,
          sortOrder: doc.sortOrder,

          createdAt: doc.createdAt,
        }));

        /* ================= RESPONSE ================= */
        return reply.send({
          success: true,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
          data: formatted,
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            user: req.user,
          },
          "❌ List lender document config failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
}

module.exports = listLenderDocumentConfigRoutes;
