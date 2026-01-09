// routes/admin/lenderProducts/create.js
const { Prisma } = require("@prisma/client");
const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  createLenderProductSchema,
} = require("../../../schemas/admin/lenderProducts/create.schema");

async function createLenderProductRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary: "Assign loan product to a lender",
        body: { type: "object" },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      try {
        // ---------------------------
        // Validate body via Zod
        // ---------------------------
        const parsed = createLenderProductSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid data",
            details: parsed.error.issues,
          });
        }

        const data = parsed.data;

        // ---------------------------
        // Validate lender organization
        // ---------------------------
        const lenderOrg = await prisma.organization.findFirst({
          where: { id: data.lenderOrgId, type: "LENDER", isDeleted: { not: true } },
        });

        if (!lenderOrg) {
          return reply.status(404).send({
            success: false,
            message: "Lender organization not found.",
          });
        }

        // ---------------------------
        // Validate that product exists
        // ---------------------------
        const loanProduct = await prisma.loanProduct.findFirst({
          where: { code: data.loanProductCode, isActive: true },
        });

        if (!loanProduct) {
          return reply.status(404).send({
            success: false,
            message: "Loan product not found.",
          });
        }

        // ---------------------------
        // Prevent duplicate mapping
        // ---------------------------
        const existing = await prisma.lenderProduct.findFirst({
          where: {
            lenderOrgId: data.lenderOrgId,
            loanProductCode: data.loanProductCode,
          },
        });

        if (existing) {
          return reply.status(409).send({
            success: false,
            message: "This lender already has this product assigned.",
          });
        }

        // ---------------------------
        // Create lender product mapping
        // ---------------------------
        const result = await prisma.lenderProduct.create({
          data: {
            lenderOrgId: data.lenderOrgId,
            loanProductId: loanProduct.id,
            loanProductCode: data.loanProductCode,

            // DECIMAL FIELDS → Prisma.Decimal
            minLoanAmount: data.minLoanAmount
              ? new Prisma.Decimal(data.minLoanAmount)
              : null,

            maxLoanAmount: data.maxLoanAmount
              ? new Prisma.Decimal(data.maxLoanAmount)
              : null,

            // INTEGER FIELDS
            minTermMonths: data.minTermMonths ?? null,
            maxTermMonths: data.maxTermMonths ?? null,

            // ARRAYS → JSON STRING
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
          message: "Lender product mapping created successfully.",
          data: result,
        });
      } catch (error) {
        adminLogs.error("LenderProduct create failed", error);
 
        return reply.status(500).send({
          success: false,
          message: "Server error while creating lender product",
        });
      }
    }
  );
}

module.exports = createLenderProductRoutes;
