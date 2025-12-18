const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient();

const {
  updateLenderLoanProductSchema,
} = require("../../../schemas/lender/loanProduct/update.schema");

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
        summary: "Update Loan Product Configuration",
        description: "Lender updates configured loan product rules",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            minLoanAmount: { type: "number" },
            maxLoanAmount: { type: "number" },
            minTermMonths: { type: "number" },
            maxTermMonths: { type: "number" },
            regionsSupported: {
              type: "array",
              items: { type: "string" },
            },
            industriesSupported: {
              type: "array",
              items: { type: "string" },
            },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        // ---------------------------
        // Auth check (middleware-aligned)
        // ---------------------------
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

        // ---------------------------
        // Zod validation
        // ---------------------------
        const parsed = updateLenderLoanProductSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const data = parsed.data;

        // ---------------------------
        // Verify ownership
        // ---------------------------
        const existing = await prisma.lenderProduct.findFirst({
          where: {
            id,
            lenderOrgId,
          },
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            message: "Loan product configuration not found",
          });
        }

        // ---------------------------
        // Update configuration
        // ---------------------------
        const updated = await prisma.lenderProduct.update({
          where: { id },
          data: {
            minLoanAmount:
              data.minLoanAmount !== undefined
                ? new Prisma.Decimal(data.minLoanAmount)
                : undefined,

            maxLoanAmount:
              data.maxLoanAmount !== undefined
                ? new Prisma.Decimal(data.maxLoanAmount)
                : undefined,

            minTermMonths: data.minTermMonths ?? undefined,
            maxTermMonths: data.maxTermMonths ?? undefined,

            regionsSupported:
              data.regionsSupported !== undefined
                ? JSON.stringify(data.regionsSupported)
                : undefined,

            industriesSupported:
              data.industriesSupported !== undefined
                ? JSON.stringify(data.industriesSupported)
                : undefined,

            isActive: data.isActive ?? undefined,
          },
        });

        return reply.send({
          success: true,
          message: "Loan product updated successfully",
          data: updated,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          message: "Server error while updating loan product",
        });
      }
    }
  );
}

module.exports = updateLenderLoanProductRoutes;
