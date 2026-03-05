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

        const parsed = updateLenderProductSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid update data",
            details: parsed.error.issues,
          });
        }

        const data = parsed.data;

        const exists = await prisma.lenderProduct.findUnique({
          where: { id: productId },
        });

        if (!exists) {
          return reply.status(404).send({
            success: false,
            message: "Lender product not found",
          });
        }

        const isEquipmentFinance =
          exists.loanProductCode === "EQUIPMENT_FINANCE";

        const updatePayload = {};

        // ---------------------------
        // Business Types
        // ---------------------------
        if (data.businessTypes !== undefined) {
          updatePayload.businessTypes = Array.isArray(data.businessTypes)
            ? data.businessTypes.join(",")
            : data.businessTypes;
        }

        // ---------------------------
        // Equipment Types
        // ---------------------------
        if (isEquipmentFinance && data.equipmentTypes !== undefined) {
          updatePayload.equipmentTypes = Array.isArray(data.equipmentTypes)
            ? data.equipmentTypes.join(",")
            : data.equipmentTypes;
        }

        if (isEquipmentFinance && data.otherEquipmentExplanation !== undefined) {
          updatePayload.otherEquipmentExplanation =
            data.otherEquipmentExplanation;
        }

        // ---------------------------
        // Loan amounts
        // ---------------------------
        if (data.minLoanAmount !== undefined) {
          updatePayload.minLoanAmount = new Prisma.Decimal(data.minLoanAmount);
        }

        if (data.maxLoanAmount !== undefined) {
          updatePayload.maxLoanAmount = new Prisma.Decimal(data.maxLoanAmount);
        }

        // ---------------------------
        // Terms
        // ---------------------------
        if (data.minTermMonths !== undefined) {
          updatePayload.minTermMonths = data.minTermMonths;
        }

        if (data.maxTermMonths !== undefined) {
          updatePayload.maxTermMonths = data.maxTermMonths;
        }

        // ---------------------------
        // LTV
        // ---------------------------
        if (data.minLtvPercent !== undefined) {
          updatePayload.minLtvPercent = new Prisma.Decimal(data.minLtvPercent);
        }

        if (data.maxLtvPercent !== undefined) {
          updatePayload.maxLtvPercent = new Prisma.Decimal(data.maxLtvPercent);
        }

        // ---------------------------
        // Credit & Experience
        // ---------------------------
        if (data.minCreditScore !== undefined) {
          updatePayload.minCreditScore = data.minCreditScore;
        }

        if (data.minExperience !== undefined) {
          updatePayload.minExperience = data.minExperience;
        }

        if (data.interestRateRange !== undefined) {
          updatePayload.interestRateRange = data.interestRateRange;
        }

        // ---------------------------
        // States
        // ---------------------------
        if (data.statesSupported !== undefined) {
          updatePayload.statesSupported = Array.isArray(data.statesSupported)
            ? data.statesSupported.join(",")
            : data.statesSupported;
        }

        // ---------------------------
        // Active flag
        // ---------------------------
        if (typeof data.isActive === "boolean") {
          updatePayload.isActive = data.isActive;
        }

        if (Object.keys(updatePayload).length === 0) {
          return reply.status(400).send({
            success: false,
            message: "No valid fields provided for update",
          });
        }

        const updatedProduct = await prisma.lenderProduct.update({
          where: { id: productId },
          data: updatePayload,
          include: {
            loanProduct: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        });

        const finalProducts = await prisma.lenderProduct.findMany({
          where: {
            lenderOrgId: exists.lenderOrgId,
          },
          include: {
            loanProduct: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return reply.send({
          success: true,
          message: "Lender product updated successfully",
          updatedProduct,
          data: finalProducts,
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