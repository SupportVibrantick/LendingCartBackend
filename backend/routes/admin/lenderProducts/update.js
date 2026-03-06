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
      const productId = request.params.id;

      try {

        // -----------------------------
        // Validate request body
        // -----------------------------
        const parsed = updateLenderProductSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid update data",
            details: parsed.error.issues,
          });
        }

        const data = parsed.data;

        // -----------------------------
        // Check if product exists
        // -----------------------------
        const existing = await prisma.lenderProduct.findUnique({
          where: { id: productId },
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            message: "Lender product not found",
          });
        }

        const isEquipmentFinance =
          existing.loanProductCode === "EQUIPMENT_FINANCE";

        const updatePayload = {};

        // -----------------------------
        // Helpers
        // -----------------------------
        const toDecimal = (value) =>
          value !== undefined && value !== null && value !== ""
            ? new Prisma.Decimal(value)
            : undefined;

        const toCsv = (value) => {
          if (value === undefined) return undefined;
          if (Array.isArray(value)) return value.length ? value.join(",") : null;
          return value;
        };

        // -----------------------------
        // Business types
        // -----------------------------
        const businessTypes = toCsv(data.businessTypes);
        if (businessTypes !== undefined)
          updatePayload.businessTypes = businessTypes;

        // -----------------------------
        // Equipment fields
        // -----------------------------
        if (isEquipmentFinance) {

          const equipmentTypes = toCsv(data.equipmentTypes);
          if (equipmentTypes !== undefined)
            updatePayload.equipmentTypes = equipmentTypes;

          if (data.otherEquipmentExplanation !== undefined)
            updatePayload.otherEquipmentExplanation =
              data.otherEquipmentExplanation || null;

        }

        // -----------------------------
        // Loan amounts
        // -----------------------------
        const minLoanAmount = toDecimal(data.minLoanAmount);
        if (minLoanAmount !== undefined)
          updatePayload.minLoanAmount = minLoanAmount;

        const maxLoanAmount = toDecimal(data.maxLoanAmount);
        if (maxLoanAmount !== undefined)
          updatePayload.maxLoanAmount = maxLoanAmount;

        // -----------------------------
        // Terms
        // -----------------------------
        if (data.minTermMonths !== undefined)
          updatePayload.minTermMonths = data.minTermMonths;

        if (data.maxTermMonths !== undefined)
          updatePayload.maxTermMonths = data.maxTermMonths;

        // -----------------------------
        // LTV
        // -----------------------------
        const minLtv = toDecimal(data.minLtvPercent);
        if (minLtv !== undefined)
          updatePayload.minLtvPercent = minLtv;

        const maxLtv = toDecimal(data.maxLtvPercent);
        if (maxLtv !== undefined)
          updatePayload.maxLtvPercent = maxLtv;

        // -----------------------------
        // Credit & Experience
        // -----------------------------
        if (data.minCreditScore !== undefined)
          updatePayload.minCreditScore = data.minCreditScore;

        if (data.minExperience !== undefined)
          updatePayload.minExperience = data.minExperience;

        if (data.interestRateRange !== undefined)
          updatePayload.interestRateRange = data.interestRateRange;

        // -----------------------------
        // States
        // -----------------------------
        const states = toCsv(data.statesSupported);
        if (states !== undefined)
          updatePayload.statesSupported = states;

        // -----------------------------
        // Active flag
        // -----------------------------
        if (typeof data.isActive === "boolean")
          updatePayload.isActive = data.isActive;

        if (!Object.keys(updatePayload).length) {
          return reply.status(400).send({
            success: false,
            message: "No valid fields provided for update",
          });
        }

        // -----------------------------
        // Update product
        // -----------------------------
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

        // -----------------------------
        // Return updated lender products
        // -----------------------------
        const products = await prisma.lenderProduct.findMany({
          where: {
            lenderOrgId: existing.lenderOrgId,
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
          data: products,
        });

      } catch (error) {

        adminLogs.error("Update lender product failed", {
          productId,
          error,
        });

        return reply.status(500).send({
          success: false,
          message: "Server error while updating lender product",
        });
      }
    }
  );
}

module.exports = updateLenderProductRoutes;