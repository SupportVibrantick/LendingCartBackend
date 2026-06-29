// routes/admin/lenderProducts/create.js

const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  createLenderProductSchema,
} = require("../../../schemas/admin/lenderProducts/create.schema");
const {
  buildLenderProductPrismaFields,
} = require("../../../utils/buildLenderProductPrismaFields");
const {
  syncLenderProductDocuments,
} = require("../../../utils/syncLenderProductDocuments");

async function createLenderProductRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary:
          "Assign lender products with per-product config + per-product business/property types",
        body: { type: "object" },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        // ---------------------------
        // Validate request
        // ---------------------------
        const parsed = createLenderProductSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid data",
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
        // Normalize products
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

  maxLtvPercent: data.maxLtvPercent,
  maxArvPercent: data.maxArvPercent,
  maxLtcPercent: data.maxLtcPercent,

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
        // Validate lender org
        // ---------------------------
        const lenderOrg = await prisma.organization.findFirst({
          where: {
            id: data.lenderOrgId,
            type: "LENDER",
            isDeleted: { not: true },
          },
        });

        if (!lenderOrg) {
          return reply.status(404).send({
            success: false,
            message: "Lender organization not found.",
          });
        }

        // ---------------------------
        // Fetch loan products
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
        // Existing mappings
        // ---------------------------
        const existing = await prisma.lenderProduct.findMany({
          where: {
            lenderOrgId: data.lenderOrgId,
            loanProductCode: { in: codes },
          },
          select: { loanProductCode: true },
        });

        const existingCodes = new Set(
          existing.map((e) => e.loanProductCode)
        );

        // ---------------------------
        // Prepare payload
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

            const { documents, ...rest } = item;

            return {
              lenderOrgId: data.lenderOrgId,
              loanProductId: product.id,
              loanProductCode: product.code,
              documents: Array.isArray(documents) ? documents : [],
              ...buildLenderProductPrismaFields({
                ...rest,
                loanProductCode: product.code,
                equipmentTypes:
                  isEquipmentFinance && item.equipmentTypes?.length
                    ? item.equipmentTypes
                    : item.equipmentTypes,
              }),
            };
          });

        if (!createPayload.length) {
          return reply.status(409).send({
            success: false,
            message:
              "All loan products are already assigned to this lender.",
          });
        }

        // ---------------------------
        // Transaction
        // ---------------------------
        const created = await prisma.$transaction(async (tx) => {
          const results = [];

          for (const item of createPayload) {
            const { documents, ...productData } = item;
            const createdProduct = await tx.lenderProduct.create({
              data: productData,
            });

            if (Array.isArray(documents) && documents.length > 0) {
              await syncLenderProductDocuments(
                tx,
                createdProduct.id,
                documents,
              );
            }

            results.push(createdProduct);
          }

          return results;
        });

        return reply.status(201).send({
          success: true,
          message: "Lender products created successfully.",
          createdCount: created.length,
          skippedLoanProductCodes: [...existingCodes],
          data: created,
        });
      } catch (error) {
        adminLogs.error("LenderProduct bulk create failed", error);

        return reply.status(500).send({
          success: false,
          message:
            error.message ||
            "Server error while creating lender products",
        });
      }
    }
  );
}

module.exports = createLenderProductRoutes;