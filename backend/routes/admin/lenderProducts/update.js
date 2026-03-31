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
      // Get all product codes
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
      // Transaction
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
          // CREATE FLOW (SAME AS CREATE API)
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

            // prevent duplicate
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
          // HELPERS
          // =========================
          const toDecimal = (val) =>
            val ? new Prisma.Decimal(val) : null;

          const toCsv = (arr) =>
            Array.isArray(arr) && arr.length
              ? arr.join(",")
              : null;

          // =========================
          // BUILD PAYLOAD (SAME AS CREATE)
          // =========================
          const payload = {
            businessTypes: item.businessTypes ?? null,
            propertyTypes: item.propertyTypes ?? null,

            minLoanAmount: item.minLoanAmount
              ? toDecimal(item.minLoanAmount)
              : null,

            maxLoanAmount: item.maxLoanAmount
              ? toDecimal(item.maxLoanAmount)
              : null,

            minTermMonths: item.minTermMonths ?? null,
            maxTermMonths: item.maxTermMonths ?? null,

            minLtvPercent: item.minLtvPercent
              ? toDecimal(item.minLtvPercent)
              : null,

            maxLtvPercent: item.maxLtvPercent
              ? toDecimal(item.maxLtvPercent)
              : null,

            minCreditScore: item.minCreditScore ?? null,
            minExperience: item.minExperience ?? null,

            interestRateRange: item.interestRateRange ?? null,

            statesSupported: toCsv(item.statesSupported),

            equipmentTypes:
              isEquipmentFinance && item.equipmentTypes?.length
                ? toCsv(item.equipmentTypes)
                : null,

            otherEquipmentExplanation: isEquipmentFinance
              ? item.otherEquipmentExplanation ?? null
              : null,

            isActive: item.isActive ?? true,
          };

          // =========================
          // EXECUTE
          // =========================
          let final;

          if (existing) {
            final = await tx.lenderProduct.update({
              where: { id: existing.id },
              data: payload,
              include: {
                loanProduct: true,
              },
            });
          } else {
            final = await tx.lenderProduct.create({
              data: {
                lenderOrgId,
                loanProductId: loanProduct.id,
                loanProductCode: loanProduct.code,
                ...payload,
              },
              include: {
                loanProduct: true,
              },
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