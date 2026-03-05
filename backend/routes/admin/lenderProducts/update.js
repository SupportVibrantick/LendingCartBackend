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

        // ---------------------------
        // Check existing product
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

        const isEquipmentFinance =
          exists.loanProductCode === "EQUIPMENT_FINANCE";

        const updatePayload = {};

        if (Array.isArray(data.businessTypes)) {
          updatePayload.businessTypes = data.businessTypes.join(",");
        }

        if (isEquipmentFinance && Array.isArray(data.equipmentTypes)) {
          updatePayload.equipmentTypes = data.equipmentTypes.join(",");
        }

        if (isEquipmentFinance && data.otherEquipmentExplanation !== undefined) {
          updatePayload.otherEquipmentExplanation =
            data.otherEquipmentExplanation;
        }

        if (data.minLoanAmount !== undefined && data.minLoanAmount !== "") {
          updatePayload.minLoanAmount = new Prisma.Decimal(data.minLoanAmount);
        }

        if (data.maxLoanAmount !== undefined && data.maxLoanAmount !== "") {
          updatePayload.maxLoanAmount = new Prisma.Decimal(data.maxLoanAmount);
        }

        if (data.minTermMonths !== undefined) {
          updatePayload.minTermMonths = data.minTermMonths;
        }

        if (data.maxTermMonths !== undefined) {
          updatePayload.maxTermMonths = data.maxTermMonths;
        }

        if (data.minLtvPercent !== undefined && data.minLtvPercent !== "") {
          updatePayload.minLtvPercent = new Prisma.Decimal(data.minLtvPercent);
        }

        if (data.maxLtvPercent !== undefined && data.maxLtvPercent !== "") {
          updatePayload.maxLtvPercent = new Prisma.Decimal(data.maxLtvPercent);
        }

        if (data.minCreditScore !== undefined) {
          updatePayload.minCreditScore = data.minCreditScore;
        }

        if (data.minExperience !== undefined) {
          updatePayload.minExperience = data.minExperience;
        }

        if (data.interestRateRange !== undefined) {
          updatePayload.interestRateRange = data.interestRateRange;
        }

        if (Array.isArray(data.statesSupported)) {
          updatePayload.statesSupported = data.statesSupported.join(",");
        }

        if (typeof data.isActive === "boolean") {
          updatePayload.isActive = data.isActive;
        }

        // ---------------------------
        // Prevent empty update
        // ---------------------------
        if (Object.keys(updatePayload).length === 0) {
          return reply.status(400).send({
            success: false,
            message: "No valid fields provided for update",
          });
        }

        // ---------------------------
        // Update selected product
        // ---------------------------
        const updatedProduct = await prisma.lenderProduct.update({
          where: { id: productId },
          data: updatePayload,
        });

        // ---------------------------
        // Deactivate deselected products
        // ---------------------------
        if (data.loanProductCodes?.length) {
          await prisma.lenderProduct.updateMany({
            where: {
              lenderOrgId: exists.lenderOrgId,
              loanProductCode: {
                notIn: data.loanProductCodes,
              },
            },
            data: {
              isActive: false,
            },
          });
        }

        // ---------------------------
        // Return updated list
        // ---------------------------
        const finalProducts = await prisma.lenderProduct.findMany({
          where: {
            lenderOrgId: exists.lenderOrgId,
          },
          orderBy: {
            createdAt: "desc",
          },
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