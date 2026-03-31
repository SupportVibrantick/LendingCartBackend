// routes/admin/lenderProducts/update.js

const { Prisma } = require("@prisma/client");
const { adminLogs } = require("../../../services/logger/contextLogger");

async function updateLenderProductRoutes(fastify) {
  fastify.patch(
    "/",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary: "Bulk update lender products (Production Level)",
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      const { lenderOrgId, products } = request.body;

      // -----------------------------
      // Validate input
      // -----------------------------
      if (!lenderOrgId || !Array.isArray(products)) {
        return reply.status(400).send({
          success: false,
          message: "lenderOrgId and products[] are required",
        });
      }

      if (!products.length) {
        return reply.status(400).send({
          success: false,
          message: "No products provided",
        });
      }

      try {
        // -----------------------------
        // Validate lender
        // -----------------------------
        const lender = await prisma.organization.findFirst({
          where: {
            id: lenderOrgId,
            type: "LENDER",
            isDeleted: { not: true },
          },
        });

        if (!lender) {
          return reply.status(404).send({
            success: false,
            message: "Lender not found",
          });
        }

        // -----------------------------
        // Transaction (CRITICAL)
        // -----------------------------
        const result = await prisma.$transaction(async (tx) => {
          const updatedProducts = [];

          for (const item of products) {
            if (!item.id) continue;

            // -----------------------------
            // Fetch existing
            // -----------------------------
            const existing = await tx.lenderProduct.findUnique({
              where: { id: item.id },
            });

            if (!existing) {
              throw new Error(`NOT_FOUND_${item.id}`);
            }

            // -----------------------------
            // Ownership validation
            // -----------------------------
            if (existing.lenderOrgId !== lenderOrgId) {
              throw new Error(`INVALID_OWNER_${item.id}`);
            }

            const isEquipmentFinance =
              existing.loanProductCode === "EQUIPMENT_FINANCE";

            // -----------------------------
            // Helpers
            // -----------------------------
            const toDecimal = (value) => {
              if (value === undefined) return undefined;
              if (value === null || value === "") return null;

              const num = Number(value);
              if (isNaN(num)) {
                throw new Error(`Invalid number: ${value}`);
              }

              return new Prisma.Decimal(num);
            };

            const toCsv = (value) => {
              if (value === undefined) return undefined;
              if (value === null || value === "") return null;

              if (Array.isArray(value)) {
                return value
                  .map((v) => String(v).trim())
                  .filter(Boolean)
                  .join(",") || null;
              }

              return String(value).trim() || null;
            };

            const normalizeArray = (value) => {
              if (value === undefined) return undefined;
              if (!Array.isArray(value)) return null;
              return value.length ? value : null;
            };

            // -----------------------------
            // Build update payload
            // -----------------------------
            const updateData = {};

            // JSON fields
            if (item.businessTypes !== undefined)
              updateData.businessTypes = normalizeArray(item.businessTypes);

            if (item.propertyTypes !== undefined)
              updateData.propertyTypes = normalizeArray(item.propertyTypes);

            // Equipment
            if (isEquipmentFinance) {
              const equipment = toCsv(item.equipmentTypes);
              if (equipment !== undefined)
                updateData.equipmentTypes = equipment;

              if (item.otherEquipmentExplanation !== undefined)
                updateData.otherEquipmentExplanation =
                  item.otherEquipmentExplanation?.trim() || null;
            }

            // Loan validation
            const minLoan = toDecimal(item.minLoanAmount);
            const maxLoan = toDecimal(item.maxLoanAmount);

            if (minLoan && maxLoan && minLoan.gt(maxLoan)) {
              throw new Error(`INVALID_LOAN_RANGE_${item.id}`);
            }

            if (minLoan !== undefined)
              updateData.minLoanAmount = minLoan;

            if (maxLoan !== undefined)
              updateData.maxLoanAmount = maxLoan;

            // Terms
            if (item.minTermMonths !== undefined)
              updateData.minTermMonths = item.minTermMonths ?? null;

            if (item.maxTermMonths !== undefined)
              updateData.maxTermMonths = item.maxTermMonths ?? null;

            // LTV validation
            const minLtv = toDecimal(item.minLtvPercent);
            const maxLtv = toDecimal(item.maxLtvPercent);

            if (minLtv && maxLtv && minLtv.gt(maxLtv)) {
              throw new Error(`INVALID_LTV_${item.id}`);
            }

            if (minLtv !== undefined)
              updateData.minLtvPercent = minLtv;

            if (maxLtv !== undefined)
              updateData.maxLtvPercent = maxLtv;

            // Other fields
            if (item.minCreditScore !== undefined)
              updateData.minCreditScore = item.minCreditScore ?? null;

            if (item.minExperience !== undefined)
              updateData.minExperience = item.minExperience ?? null;

            if (item.interestRateRange !== undefined)
              updateData.interestRateRange =
                item.interestRateRange?.trim() || null;

            const states = toCsv(item.statesSupported);
            if (states !== undefined)
              updateData.statesSupported = states;

            if (typeof item.isActive === "boolean")
              updateData.isActive = item.isActive;

            // Skip empty updates
            if (!Object.keys(updateData).length) continue;

            // -----------------------------
            // Update
            // -----------------------------
            const updated = await tx.lenderProduct.update({
              where: { id: item.id },
              data: updateData,
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

            updatedProducts.push(updated);
          }

          return updatedProducts;
        });

        // -----------------------------
        // Normalize response
        // -----------------------------
        const formatted = result.map((item) => ({
          ...item,
          statesSupported: item.statesSupported
            ? item.statesSupported.split(",").map((s) => s.trim())
            : [],
          equipmentTypes: item.equipmentTypes
            ? item.equipmentTypes.split(",").map((e) => e.trim())
            : [],
          businessTypes: Array.isArray(item.businessTypes)
            ? item.businessTypes
            : [],
          propertyTypes: Array.isArray(item.propertyTypes)
            ? item.propertyTypes
            : [],
        }));

        return reply.send({
          success: true,
          message: "Lender products updated successfully",
          updatedCount: formatted.length,
          data: formatted,
        });
      } catch (error) {
        adminLogs.error("Bulk update failed", {
          error: error.message,
          payload: request.body,
        });

        return reply.status(500).send({
          success: false,
          message: error.message || "Bulk update failed",
        });
      }
    }
  );
}

module.exports = updateLenderProductRoutes;