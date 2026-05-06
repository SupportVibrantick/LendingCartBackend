/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listLenderDocumentConfigRoutes(fastify) {
  fastify.get(
    "/",
    {
      preHandler: [fastify.authenticate],

      schema: {
        tags: ["Lender -> Document Config"],
        summary: "List lender document configs (with filters + pagination)",

        querystring: {
          type: "object",
          properties: {
            lenderProductId: {
              type: "string",
              format: "uuid",
            },

            loanProductCode: {
              type: "string",
            },

            search: {
              type: "string",
            },

            isRequired: {
              type: "boolean",
            },

            isCustom: {
              type: "boolean",
            },

            page: {
              type: "number",
              minimum: 1,
              default: 1,
            },

            limit: {
              type: "number",
              minimum: 1,
              maximum: 100,
              default: 10,
            },
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

        page = Number(page) || 1;
        limit = Number(limit) || 10;

        const skip = (page - 1) * limit;

        /* ================= WHERE ================= */

        const where = {
          lenderProduct: {
            lenderOrgId,
          },
        };

        // ✅ Product filter
        if (lenderProductId) {
          where.lenderProductId = lenderProductId;
        }

        // ✅ Loan product code filter
        if (loanProductCode) {
          where.lenderProduct = {
            ...where.lenderProduct,
            loanProductCode,
          };
        }

        // ✅ Required filter
        if (typeof isRequired === "boolean") {
          where.isRequired = isRequired;
        }

        // ✅ Document type filters
        if (typeof isCustom === "boolean" || search) {
          where.documentType = {};

          if (typeof isCustom === "boolean") {
            where.documentType.isCustom = isCustom;
          }

          if (search) {
            where.documentType.OR = [
              {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                code: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ];
          }
        }

        /* ================= FETCH ================= */

        const [docs, total] = await Promise.all([
          prisma.lenderDocumentRequirement.findMany({
            where,

            include: {
              // ✅ Document master
              documentType: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  isCustom: true,
                  description: true,
                },
              },

              // ✅ Product info
              lenderProduct: {
                select: {
                  id: true,
                  loanProductCode: true,

                  loanProduct: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                    },
                  },
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

          prisma.lenderDocumentRequirement.count({
            where,
          }),
        ]);

        /* ================= FORMAT ================= */

        const formatted = docs.map((doc) => ({
          id: doc.id,

          // ✅ Product Info
          lenderProductId: doc.lenderProductId,

          loanProduct: {
            id: doc.lenderProduct?.loanProduct?.id || null,
            name: doc.lenderProduct?.loanProduct?.name || null,
            code: doc.lenderProduct?.loanProduct?.code || null,
          },

          loanProductCode:
            doc.lenderProduct?.loanProductCode || null,

          // ✅ Document Type Info
          documentType: {
            id: doc.documentType?.id || null,
            name: doc.documentType?.name || null,
            code: doc.documentType?.code || null,
            isCustom: doc.documentType?.isCustom || false,
            description:
              doc.documentType?.description || null,
          },

          // ✅ Config
          config: {
            isRequired: doc.isRequired,
            minFiles: doc.minFiles,
            maxFiles: doc.maxFiles,
            notes: doc.notes || null,
            sortOrder: doc.sortOrder,
          },

          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
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
          message:
            error.message || "Internal server error",
        });
      }
    }
  );
}

module.exports = listLenderDocumentConfigRoutes;