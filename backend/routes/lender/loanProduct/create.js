const { Prisma } = require("@prisma/client");
const {
  createLenderLoanProductSchema,
} = require("../../../schemas/lender/loanProduct/create.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createLenderLoanProductRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender -> Loan Products"],
        summary: "Create lender loan product configurations (Admin-level)",
        body: { type: "object" },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // ---------------------------
        // 🔐 AUTH CHECK
        // ---------------------------
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;

        // ---------------------------
        // 🧪 VALIDATION
        // ---------------------------
        const parsed = createLenderLoanProductSchema.safeParse(
          req.body
        );

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const data = parsed.data;

        const isNewFormat = Array.isArray(data.products);

        if (!isNewFormat && !data.loanProductCodes) {
          return reply.status(400).send({
            success: false,
            message:
              "Either 'products' or 'loanProductCodes' must be provided.",
          });
        }

        // ---------------------------
        // 🔄 NORMALIZATION
        // ---------------------------
        let normalizedProducts = [];

        if (isNewFormat) {
          normalizedProducts = data.products;
        } else {
          normalizedProducts = data.loanProductCodes.map((code) => ({
            loanProductCode: code,

            businessTypes: data.businessTypes,
            propertyTypes: data.propertyTypes,

            minLoanAmount: data.minLoanAmount,
            maxLoanAmount: data.maxLoanAmount,
            minTermMonths: data.minTermMonths,
            maxTermMonths: data.maxTermMonths,
            minLtvPercent: data.minLtvPercent,
            maxLtvPercent: data.maxLtvPercent,
            minCreditScore: data.minCreditScore,
            minExperience: data.minExperience,
            interestRateRange: data.interestRateRange,
            statesSupported: data.statesSupported,
            isActive: data.isActive,
          }));
        }

        if (!normalizedProducts.length) {
          return reply.status(400).send({
            success: false,
            message: "No products provided.",
          });
        }

        // ---------------------------
        // 🏦 VALIDATE MASTER PRODUCTS
        // ---------------------------
        const codes = normalizedProducts.map(
          (p) => p.loanProductCode
        );

        const loanProducts = await prisma.loanProduct.findMany({
          where: {
            code: { in: codes },
            isActive: true,
          },
        });

        if (loanProducts.length !== codes.length) {
          return reply.status(404).send({
            success: false,
            message:
              "One or more loan products not found or inactive.",
          });
        }

        // ---------------------------
        // 🔁 CHECK EXISTING
        // ---------------------------
        const existing = await prisma.lenderProduct.findMany({
          where: {
            lenderOrgId,
            loanProductCode: { in: codes },
          },
          select: { loanProductCode: true },
        });

        const existingCodes = new Set(
          existing.map((e) => e.loanProductCode)
        );

        // ---------------------------
        // 📦 PREPARE PAYLOAD
        // ---------------------------
        const createPayload = normalizedProducts
          .filter(
            (item) => !existingCodes.has(item.loanProductCode)
          )
          .map((item) => {
            const product = loanProducts.find(
              (p) => p.code === item.loanProductCode
            );

            if (!product) {
              throw new Error(
                `Invalid loan product code: ${item.loanProductCode}`
              );
            }

            const isEquipmentFinance =
              item.loanProductCode === "EQUIPMENT_FINANCE";

            return {
              lenderOrgId,
              loanProductId: product.id,
              loanProductCode: product.code,

              businessTypes: item.businessTypes ?? null,
              propertyTypes: item.propertyTypes ?? null,

              minLoanAmount: item.minLoanAmount
                ? new Prisma.Decimal(item.minLoanAmount)
                : null,

              maxLoanAmount: item.maxLoanAmount
                ? new Prisma.Decimal(item.maxLoanAmount)
                : null,

              minTermMonths: item.minTermMonths ?? null,
              maxTermMonths: item.maxTermMonths ?? null,

              minLtvPercent: item.minLtvPercent
                ? new Prisma.Decimal(item.minLtvPercent)
                : null,

              maxLtvPercent: item.maxLtvPercent
                ? new Prisma.Decimal(item.maxLtvPercent)
                : null,

              minCreditScore: item.minCreditScore ?? null,
              minExperience: item.minExperience ?? null,

              interestRateRange: item.interestRateRange ?? null,

              statesSupported:
                item.statesSupported?.join(",") ?? null,

              equipmentTypes:
                isEquipmentFinance && item.equipmentTypes?.length
                  ? item.equipmentTypes.join(",")
                  : null,

              otherEquipmentExplanation:
                isEquipmentFinance
                  ? item.otherEquipmentExplanation ?? null
                  : null,

              isActive: item.isActive ?? true,
            };
          });

        if (!createPayload.length) {
          return reply.status(409).send({
            success: false,
            message:
              "All loan products already configured.",
          });
        }

        // ---------------------------
        // 💥 TRANSACTION
        // ---------------------------
        const created = await prisma.$transaction(
          createPayload.map((d) =>
            prisma.lenderProduct.create({ data: d })
          )
        );

        return reply.status(201).send({
          success: true,
          message: "Loan products configured successfully",
          createdCount: created.length,
          skippedLoanProductCodes: [...existingCodes],
          data: created,
        });
      } catch (error) {
        req.log.error(error);

        return reply.status(500).send({
          success: false,
          message:
            error.message ||
            "Server error while configuring loan product",
        });
      }
    }
  );
}

module.exports = createLenderLoanProductRoutes;