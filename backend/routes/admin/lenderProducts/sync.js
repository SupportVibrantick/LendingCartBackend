const { Prisma } = require("@prisma/client");
const { adminLogs } = require("../../../services/logger/contextLogger");

async function syncLenderProductsRoutes(fastify) {
  fastify.patch(
    "/sync",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary: "Sync lender products configuration",
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const data = request.body;

        const {
          lenderOrgId,
          loanProductCodes = [],
          businessTypes,
          equipmentTypes,
          otherEquipmentExplanation,
          minLoanAmount,
          maxLoanAmount,
          minTermMonths,
          maxTermMonths,
          minLtvPercent,
          maxLtvPercent,
          minCreditScore,
          minExperience,
          interestRateRange,
          statesSupported,
        } = data;

        if (!lenderOrgId) {
          return reply.status(400).send({
            success: false,
            message: "lenderOrgId is required",
          });
        }

        /* ------------------------------------------------ */
        /* Validate lender organization */
        /* ------------------------------------------------ */

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

        /* ------------------------------------------------ */
        /* Fetch existing lender products */
        /* ------------------------------------------------ */

        const existingProducts = await prisma.lenderProduct.findMany({
          where: { lenderOrgId },
        });

        const existingMap = new Map();

        existingProducts.forEach((p) => {
          existingMap.set(p.loanProductCode, p);
        });

        /* ------------------------------------------------ */
        /* Fetch loan product master */
        /* ------------------------------------------------ */

        const loanProducts = await prisma.loanProduct.findMany({
          where: {
            code: { in: loanProductCodes },
            isActive: true,
          },
        });

        const loanProductMap = new Map();

        loanProducts.forEach((p) => {
          loanProductMap.set(p.code, p);
        });

        /* ------------------------------------------------ */
        /* Helpers */
        /* ------------------------------------------------ */

        const toDecimal = (value) =>
          value !== undefined && value !== null
            ? new Prisma.Decimal(value)
            : null;

        const toCsv = (arr) =>
          Array.isArray(arr) && arr.length ? arr.join(",") : null;

        const operations = [];

        /* ------------------------------------------------ */
        /* Handle selected products (create or update) */
        /* ------------------------------------------------ */

        for (const code of loanProductCodes) {
          const existing = existingMap.get(code);
          const loanProduct = loanProductMap.get(code);

          if (!loanProduct) continue;

          const isEquipmentFinance = code === "EQUIPMENT_FINANCE";

          const payload = {
            businessTypes: toCsv(businessTypes),

            equipmentTypes: isEquipmentFinance
              ? toCsv(equipmentTypes)
              : null,

            otherEquipmentExplanation: isEquipmentFinance
              ? otherEquipmentExplanation || null
              : null,

            minLoanAmount: toDecimal(minLoanAmount),
            maxLoanAmount: toDecimal(maxLoanAmount),

            minTermMonths: minTermMonths ?? null,
            maxTermMonths: maxTermMonths ?? null,

            minLtvPercent: toDecimal(minLtvPercent),
            maxLtvPercent: toDecimal(maxLtvPercent),

            minCreditScore: minCreditScore ?? null,
            minExperience: minExperience ?? null,

            interestRateRange: interestRateRange ?? null,

            statesSupported: toCsv(statesSupported),

            isActive: true,
          };

          /* UPDATE existing */

          if (existing) {
            operations.push(
              prisma.lenderProduct.update({
                where: { id: existing.id },
                data: payload,
              })
            );
          }

          /* CREATE new */

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

        /* ------------------------------------------------ */
        /* Deactivate unselected products */
        /* ------------------------------------------------ */

        for (const existing of existingProducts) {
          if (!loanProductCodes.includes(existing.loanProductCode)) {
            operations.push(
              prisma.lenderProduct.update({
                where: { id: existing.id },
                data: { isActive: false },
              })
            );
          }
        }

        /* ------------------------------------------------ */
        /* Execute transaction */
        /* ------------------------------------------------ */

        await prisma.$transaction(operations);

        /* ------------------------------------------------ */
        /* Return updated list */
        /* ------------------------------------------------ */

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
        adminLogs.error("Lender product sync failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while syncing lender products",
        });
      }
    }
  );
}

module.exports = syncLenderProductsRoutes;