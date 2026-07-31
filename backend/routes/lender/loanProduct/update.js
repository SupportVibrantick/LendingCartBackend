const { Prisma } = require("@prisma/client");

const {
  updateLenderLoanProductSchema,
} = require("../../../schemas/lender/loanProduct/update.schema");
const {
  buildLenderProductUpdateFields,
} = require("../../../utils/lender/buildLenderProductUpdateFields");
const {
  formatLenderProductListItem,
} = require("../../../utils/lender/formatLenderProductListItem");
const { stripNullValues } = require("../../../utils/common/stripNullValues");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function updateLenderLoanProductRoutes(fastify) {
  fastify.put(
    "/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Lender -> Loan Products"],
        summary: "Update lender loan product",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: { type: "object" },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { id } = req.params;

        const parsed = updateLenderLoanProductSchema.safeParse(
          stripNullValues(req.body),
        );

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const data = parsed.data;

        const existing = await prisma.lenderProduct.findFirst({
          where: { id, lenderOrgId },
          include: {
            loanProduct: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            lenderDocumentRequirements: {
              include: {
                documentType: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    isCustom: true,
                  },
                },
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            message: "Loan product configuration not found",
          });
        }

        const updateData = buildLenderProductUpdateFields(
          data,
          existing.loanProductCode,
        );

        if (Object.keys(updateData).length === 0) {
          return reply.status(400).send({
            success: false,
            message: "No fields provided for update",
          });
        }

        const updated = await prisma.lenderProduct.update({
          where: { id },
          data: updateData,
          include: {
            loanProduct: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            lenderDocumentRequirements: {
              include: {
                documentType: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    isCustom: true,
                  },
                },
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        const formatted = formatLenderProductListItem(updated);

        return reply.send({
          success: true,
          message: "Loan product updated successfully",
          data: formatted,
        });
      } catch (error) {
        req.log.error(error);

        return reply.status(500).send({
          success: false,
          message: error.message || "Server error while updating loan product",
        });
      }
    },
  );
}

module.exports = updateLenderLoanProductRoutes;
