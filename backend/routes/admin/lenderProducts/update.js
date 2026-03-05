// routes/admin/lenderProducts/update.js
const { Prisma } = require("@prisma/client");
const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  updateLenderProductSchema,
} = require("../../../schemas/admin/lenderProducts/update.schema");

async function updateLenderProductRoutes(fastify) {
  fastify.patch(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary: "Update lender product configuration",
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const productId = request.params.id;

        // ---------------------------
        // Validate request body
        // ---------------------------
        const parsed = updateLenderProductSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid update data",
            details: parsed.error.issues,
          });
        }

        const data = parsed.data;

        // ---------------------------
        // Check if lender product exists
        // ---------------------------
        const exists = await prisma.lenderProduct.findUnique({
          where: { id: productId },
        });

        if (!exists) {
          return reply.status(404).send({
            success: false,
            message: "Lender product not found",
          });
        }

        // ---------------------------
        // Prepare update payload
        // (same logic as create API)
        // ---------------------------
        const updatePayload = {
          businessTypes: data.businessTypes
            ? data.businessTypes.join(",")
            : undefined,

          minLoanAmount: data.minLoanAmount
            ? new Prisma.Decimal(data.minLoanAmount)
            : undefined,

          maxLoanAmount: data.maxLoanAmount
            ? new Prisma.Decimal(data.maxLoanAmount)
            : undefined,

          minTermMonths: data.minTermMonths ?? undefined,
          maxTermMonths: data.maxTermMonths ?? undefined,

          minLtvPercent: data.minLtvPercent
            ? new Prisma.Decimal(data.minLtvPercent)
            : undefined,

          maxLtvPercent: data.maxLtvPercent
            ? new Prisma.Decimal(data.maxLtvPercent)
            : undefined,

          minCreditScore: data.minCreditScore ?? undefined,
          minExperience: data.minExperience ?? undefined,

          interestRateRange: data.interestRateRange ?? undefined,

          statesSupported: data.statesSupported
            ? data.statesSupported.join(",")
            : undefined,

          isActive: data.isActive ?? undefined,
        };

        // ---------------------------
        // Update record
        // ---------------------------
        const updated = await prisma.lenderProduct.update({
          where: { id: productId },
          data: updatePayload,
        });

        return reply.send({
          success: true,
          message: "Lender product updated successfully",
          data: updated,
        });
      } catch (error) {
        adminLogs.error("Update lender product failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while updating lender product",
        });
      }
    }
  );
}

module.exports = updateLenderProductRoutes;