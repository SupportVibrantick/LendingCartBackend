const { PrismaClient, Prisma } = require("@prisma/client");
const prisma = new PrismaClient();

const {
  createLenderLoanProductSchema,
} = require("../../../schemas/lender/loanProduct/create.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createLenderLoanProductRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender -> Loan Products"],
        summary: "Configure Loan Product",
        description:
          "Lender configures an admin-created loan product category",
        consumes: ["application/json"],
        body: {
          type: "object",
          required: ["loanProductCode"],
          additionalProperties: false,
          properties: {
            loanProductCode: { type: "string" },
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
        // Auth safety (middleware-aligned)
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

        // ---------------------------
        // Zod validation
        // ---------------------------
        const parsed = createLenderLoanProductSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const data = parsed.data;

        // ---------------------------
        // Validate loan product category
        // ---------------------------
        const loanProduct = await prisma.loanProduct.findFirst({
          where: {
            code: data.loanProductCode,
            isActive: true,
          },
        });

        if (!loanProduct) {
          return reply.status(404).send({
            success: false,
            message: "Loan product category not found",
          });
        }

        // ---------------------------
        // Prevent duplicate configuration
        // ---------------------------
        const existing = await prisma.lenderProduct.findFirst({
          where: {
            lenderOrgId,
            loanProductCode: data.loanProductCode,
          },
        });

        if (existing) {
          return reply.status(409).send({
            success: false,
            message: "Loan product already configured",
          });
        }

        // ---------------------------
        // Create lender product configuration
        // ---------------------------
        const result = await prisma.lenderProduct.create({
          data: {
            lenderOrgId,
            loanProductId: loanProduct.id,
            loanProductCode: data.loanProductCode,

            minLoanAmount: data.minLoanAmount
              ? new Prisma.Decimal(data.minLoanAmount)
              : null,
            maxLoanAmount: data.maxLoanAmount
              ? new Prisma.Decimal(data.maxLoanAmount)
              : null,

            minTermMonths: data.minTermMonths ?? null,
            maxTermMonths: data.maxTermMonths ?? null,

            regionsSupported: data.regionsSupported
              ? JSON.stringify(data.regionsSupported)
              : null,
            industriesSupported: data.industriesSupported
              ? JSON.stringify(data.industriesSupported)
              : null,

            isActive: data.isActive ?? true,
          },
        });

        return reply.status(201).send({
          success: true,
          message: "Loan product configured successfully",
          data: result,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          message: "Server error while configuring loan product",
        });
      }
    }
  );
}

module.exports = createLenderLoanProductRoutes;
