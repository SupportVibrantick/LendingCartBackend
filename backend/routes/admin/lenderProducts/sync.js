// routes/admin/lenderProducts/sync.js

const { Prisma } = require("@prisma/client");
const { adminLogs } = require("../../../services/logger/contextLogger");

async function syncLenderProductsRoutes(fastify) {
  fastify.patch(
    "/sync",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary: "Sync lender products (per-product config)",
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const { lenderOrgId, products = [] } = request.body;

        // -----------------------------
        // Validation
        // -----------------------------
        if (!lenderOrgId) {
          return reply.status(400).send({
            success: false,
            message: "lenderOrgId is required",
          });
        }

        if (!Array.isArray(products) || !products.length) {
          return reply.status(400).send({
            success: false,
            message: "products array is required",
          });
        }

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
            message: "Lender organization not found",
          });
        }

        // -----------------------------
        // Existing products
        // -----------------------------
        const existingProducts = await prisma.lenderProduct.findMany({
          where: { lenderOrgId },
        });

        const existingMap = new Map(
          existingProducts.map((p) => [p.loanProductCode, p])
        );

        // -----------------------------
        // Fetch loan products
        // -----------------------------
        const codes = products.map((p) => p.loanProductCode);

        const loanProducts = await prisma.loanProduct.findMany({
          where: {
            code: { in: codes },
            isActive: true,
          },
        });

        const loanProductMap = new Map(
          loanProducts.map((p) => [p.code, p])
        );

        // -----------------------------
        // Helpers
        // -----------------------------
        const toDecimal = (val) => {
          if (val === undefined) return null;
          if (val === null || val === "") return null;
          if (isNaN(val)) throw new Error(`Invalid number: ${val}`);
          return new Prisma.Decimal(val);
        };

        const toCsv = (arr) =>
          Array.isArray(arr) && arr.length ? arr.join(",") : null;

        const operations = [];

        // -----------------------------
        // CREATE / UPDATE
        // -----------------------------
        for (const item of products) {
          const existing = existingMap.get(item.loanProductCode);
          const loanProduct = loanProductMap.get(item.loanProductCode);

          if (!loanProduct) continue;

          const isEquipmentFinance =
            item.loanProductCode === "EQUIPMENT_FINANCE";

          const payload = {
            // ✅ JSON fields
            businessTypes: item.businessTypes ?? null,
            propertyTypes: item.propertyTypes ?? null,

            // ✅ Equipment (string)
            equipmentTypes:
              isEquipmentFinance && Array.isArray(item.equipmentTypes)
                ? item.equipmentTypes.join(",")
                : null,

            otherEquipmentExplanation: isEquipmentFinance
              ? item.otherEquipmentExplanation ?? null
              : null,

            // financials
            minLoanAmount: toDecimal(item.minLoanAmount),
            maxLoanAmount: toDecimal(item.maxLoanAmount),

            minTermMonths: item.minTermMonths ?? null,
            maxTermMonths: item.maxTermMonths ?? null,

            minLtvPercent: toDecimal(item.minLtvPercent),
            maxLtvPercent: toDecimal(item.maxLtvPercent),

            minCreditScore: item.minCreditScore ?? null,
            minExperience: item.minExperience ?? null,

            interestRateRange: item.interestRateRange ?? null,

            statesSupported: toCsv(item.statesSupported),

            isActive: item.isActive ?? true,
          };

          // UPDATE
          if (existing) {
            operations.push(
              prisma.lenderProduct.update({
                where: { id: existing.id },
                data: payload,
              })
            );
          }

          // CREATE
          else {
            operations.push(
              prisma.lenderProduct.create({
                data: {
                  lenderOrgId,
                  loanProductId: loanProduct.id,
                  loanProductCode: loanProduct.code,
                  ...payload,
                },
              })
            );
          }
        }

        // -----------------------------
        // DEACTIVATE removed products
        // -----------------------------
        for (const existing of existingProducts) {
          if (!codes.includes(existing.loanProductCode)) {
            operations.push(
              prisma.lenderProduct.update({
                where: { id: existing.id },
                data: { isActive: false },
              })
            );
          }
        }

        // -----------------------------
        // Execute transaction
        // -----------------------------
        await prisma.$transaction(operations);

        // -----------------------------
        // Return updated list
        // -----------------------------
        const finalProducts = await prisma.lenderProduct.findMany({
          where: { lenderOrgId },
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
          message: "Lender products synced successfully",
          data: finalProducts,
        });
      } catch (error) {
        adminLogs.error("Lender product sync failed", {
          error: error.message,
          payload: request.body,
        });

        return reply.status(500).send({
          success: false,
          message:
            process.env.NODE_ENV === "development"
              ? error.message
              : "Server error while syncing lender products",
        });
      }
    }
  );
}

module.exports = syncLenderProductsRoutes;