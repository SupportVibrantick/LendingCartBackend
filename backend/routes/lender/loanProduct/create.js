const {
  createLenderLoanProductSchema,
} = require("../../../schemas/lender/loanProduct/create.schema");
const {
  buildLenderProductPrismaFields,
} = require("../../../utils/lender/buildLenderProductPrismaFields");
const { stripNullValues } = require("../../../utils/common/stripNullValues");

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

        const parsed = createLenderLoanProductSchema.safeParse(
          stripNullValues(req.body),
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
            maxLtvPercent: data.maxLtvPercent,
            maxArvPercent: data.maxArvPercent,
            maxLtcPercent: data.maxLtcPercent,
            minCreditScore: data.minCreditScore,
            minExperience: data.minExperience,
            interestRateRange: data.interestRateRange,
            statesSupported: data.statesSupported,
            equipmentTypes: data.equipmentTypes,
            otherEquipmentExplanation: data.otherEquipmentExplanation,
            isActive: data.isActive,
          }));
        }

        if (!normalizedProducts.length) {
          return reply.status(400).send({
            success: false,
            message: "No products provided.",
          });
        }

        const codes = normalizedProducts.map((product) => product.loanProductCode);

        const loanProducts = await prisma.loanProduct.findMany({
          where: {
            code: { in: codes },
            isActive: true,
          },
        });

        if (loanProducts.length !== codes.length) {
          return reply.status(404).send({
            success: false,
            message: "One or more loan products not found or inactive.",
          });
        }

        const existing = await prisma.lenderProduct.findMany({
          where: {
            lenderOrgId,
            loanProductCode: { in: codes },
          },
          select: { loanProductCode: true },
        });

        const existingCodes = new Set(existing.map((entry) => entry.loanProductCode));

        const createPayload = normalizedProducts
          .filter((item) => !existingCodes.has(item.loanProductCode))
          .map((item) => {
            const product = loanProducts.find(
              (entry) => entry.code === item.loanProductCode,
            );

            if (!product) {
              throw new Error(`Invalid loan product code: ${item.loanProductCode}`);
            }

            const prismaFields = buildLenderProductPrismaFields({
              ...item,
              loanProductCode: product.code,
            });

            return {
              lenderOrgId,
              loanProductId: product.id,
              loanProductCode: product.code,
              ...prismaFields,
            };
          });

        if (!createPayload.length) {
          return reply.status(409).send({
            success: false,
            message: "All loan products already configured.",
          });
        }

        const created = await prisma.$transaction(
          createPayload.map((entry) => prisma.lenderProduct.create({ data: entry })),
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
          message: error.message || "Server error while configuring loan product",
        });
      }
    },
  );
}

module.exports = createLenderLoanProductRoutes;
