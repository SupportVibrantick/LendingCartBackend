// routes/admin/lenderProducts/update.js

const { Prisma } = require("@prisma/client");
const { adminLogs } = require("../../../services/logger/contextLogger");

async function updateLenderProductRoutes(fastify) {
  fastify.patch("/", async (request, reply) => {
    const prisma = fastify.prisma;

    const { lenderOrgId, products } = request.body;

    if (!lenderOrgId || !Array.isArray(products)) {
      return reply.status(400).send({
        success: false,
        message: "lenderOrgId and products[] are required",
      });
    }

    try {
      // ---------------------------
      // Validate lender
      // ---------------------------
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

      // ---------------------------
      // Pre-fetch loan products
      // ---------------------------
      const codes = products
        .filter((p) => !p.id && p.loanProductCode)
        .map((p) => p.loanProductCode);

      const loanProducts = await prisma.loanProduct.findMany({
        where: {
          code: { in: codes },
          isActive: true,
        },
      });

      // ---------------------------
      // HELPERS (FIXED)
      // ---------------------------
      const toDecimal = (val) =>
        val !== undefined && val !== null && val !== ""
          ? new Prisma.Decimal(val)
          : null;

      const toCsv = (arr) =>
        Array.isArray(arr) && arr.length
          ? arr.map((v) => String(v).trim()).filter(Boolean).join(",")
          : null;

      // ---------------------------
      // TRANSACTION
      // ---------------------------
      const result = await prisma.$transaction(async (tx) => {
        const finalProducts = [];

        for (const item of products) {
          let existing = null;

          // =========================
          // UPDATE FLOW
          // =========================
          if (item.id) {
            existing = await tx.lenderProduct.findUnique({
              where: { id: item.id },
            });

            if (!existing) {
              throw new Error(`NOT_FOUND_${item.id}`);
            }

            if (existing.lenderOrgId !== lenderOrgId) {
              throw new Error(`INVALID_OWNER_${item.id}`);
            }
          }

          // =========================
          // CREATE FLOW
          // =========================
          let loanProduct = null;

          if (!existing) {
            if (!item.loanProductCode) {
              throw new Error("loanProductCode required");
            }

            loanProduct = loanProducts.find(
              (lp) => lp.code === item.loanProductCode
            );

            if (!loanProduct) {
              throw new Error(
                `INVALID_LOAN_PRODUCT_${item.loanProductCode}`
              );
            }

            // Prevent duplicate (UNIQUE constraint safe)
            const duplicate = await tx.lenderProduct.findFirst({
              where: {
                lenderOrgId,
                loanProductCode: item.loanProductCode,
              },
            });

            if (duplicate) {
              existing = duplicate;
            }
          }

          const isEquipmentFinance =
            (existing?.loanProductCode ||
              item.loanProductCode) === "EQUIPMENT_FINANCE";

          // =========================
          // BUILD SAFE PAYLOAD
          // =========================
          const payload = {
            ...(item.businessTypes !== undefined && {
              businessTypes: item.businessTypes,
            }),

            ...(item.propertyTypes !== undefined && {
              propertyTypes: item.propertyTypes,
            }),

            ...(item.minLoanAmount !== undefined && {
              minLoanAmount: toDecimal(item.minLoanAmount),
            }),

            ...(item.maxLoanAmount !== undefined && {
              maxLoanAmount: toDecimal(item.maxLoanAmount),
            }),

            ...(item.minTermMonths !== undefined && {
              minTermMonths: item.minTermMonths ?? null,
            }),

            ...(item.maxTermMonths !== undefined && {
              maxTermMonths: item.maxTermMonths ?? null,
            }),

            ...(item.minLtvPercent !== undefined && {
              minLtvPercent: toDecimal(item.minLtvPercent),
            }),

            ...(item.maxLtvPercent !== undefined && {
              maxLtvPercent: toDecimal(item.maxLtvPercent),
            }),

            ...(item.minCreditScore !== undefined && {
              minCreditScore: item.minCreditScore ?? null,
            }),

            // ✅ FIXED (STRING)
            ...(item.minExperience !== undefined && {
              minExperience:
                item.minExperience === null
                  ? null
                  : String(item.minExperience),
            }),

            ...(item.interestRateRange !== undefined && {
              interestRateRange:
                item.interestRateRange?.trim() || null,
            }),

            ...(item.statesSupported !== undefined && {
              statesSupported: toCsv(item.statesSupported),
            }),

            // ✅ EQUIPMENT SAFE
            ...(isEquipmentFinance &&
              item.equipmentTypes !== undefined && {
                equipmentTypes: toCsv(item.equipmentTypes),
              }),

            ...(isEquipmentFinance &&
              item.otherEquipmentExplanation !== undefined && {
                otherEquipmentExplanation:
                  item.otherEquipmentExplanation?.trim() || null,
              }),

            ...(typeof item.isActive === "boolean" && {
              isActive: item.isActive,
            }),
          };

          let final;

          // =========================
          // EXECUTE UPSERT
          // =========================
          if (existing) {
            final = await tx.lenderProduct.update({
              where: { id: existing.id },
              data: payload,
              include: { loanProduct: true },
            });
          } else {
            final = await tx.lenderProduct.create({
              data: {
                lenderOrgId,
                loanProductId: loanProduct.id,
                loanProductCode: loanProduct.code,
                ...payload,
              },
              include: { loanProduct: true },
            });
          }

          finalProducts.push(final);
        }

        return finalProducts;
      });

      return reply.send({
        success: true,
        message: "Products upserted successfully",
        count: result.length,
        data: result,
      });
    } catch (error) {
      adminLogs.error("UPSERT failed", error);

      return reply.status(500).send({
        success: false,
        message: error.message || "Server error",
      });
    }
  });
}

module.exports = updateLenderProductRoutes;