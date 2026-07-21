// routes/admin/lenderProducts/update.js

const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  buildLenderProductPrismaFields,
} = require("../../../utils/lender/buildLenderProductPrismaFields");
const {
  syncLenderProductDocuments,
  mapLenderDocumentRequirements,
} = require("../../../utils/lender/syncLenderProductDocuments");
const {
  normalizeLenderProductForAdminApi,
} = require("../../../utils/lender/normalizeLenderProductResponse");
const {
  updateLenderProductSchema,
} = require("../../../schemas/admin/lenderProducts/update.schema");

async function updateLenderProductRoutes(fastify) {
  fastify.patch("/", async (request, reply) => {
    const prisma = fastify.prisma;

    const parsed = updateLenderProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten(),
      });
    }

    const { lenderOrgId, products } = parsed.data;

    try {
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

      const codes = products
        .filter((p) => !p.id && p.loanProductCode)
        .map((p) => p.loanProductCode);

      const loanProducts = await prisma.loanProduct.findMany({
        where: {
          code: { in: codes },
          isActive: true,
        },
      });

      const result = await prisma.$transaction(async (tx) => {
        const finalProducts = [];

        for (const item of products) {
          let existing = null;

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

          let loanProduct = null;

          if (!existing) {
            if (!item.loanProductCode) {
              throw new Error("loanProductCode required");
            }

            loanProduct = loanProducts.find(
              (lp) => lp.code === item.loanProductCode,
            );

            if (!loanProduct) {
              throw new Error(
                `INVALID_LOAN_PRODUCT_${item.loanProductCode}`,
              );
            }

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

          const productCode =
            existing?.loanProductCode || item.loanProductCode;

          const { documents, ...productInput } = item;

          const payload = buildLenderProductPrismaFields({
            ...productInput,
            loanProductCode: productCode,
          });

          let final;

          if (existing) {
            final = await tx.lenderProduct.update({
              where: { id: existing.id },
              data: payload,
              include: {
                loanProduct: true,
                lenderDocumentRequirements: {
                  include: {
                    documentType: {
                      select: {
                        id: true,
                        name: true,
                        code: true,
                        isCustom: true,
                      },
                    },
                  },
                  orderBy: { sortOrder: "asc" },
                },
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
                lenderDocumentRequirements: {
                  include: {
                    documentType: {
                      select: {
                        id: true,
                        name: true,
                        code: true,
                        isCustom: true,
                      },
                    },
                  },
                  orderBy: { sortOrder: "asc" },
                },
              },
            });
          }

          if (Array.isArray(documents)) {
            await syncLenderProductDocuments(tx, final.id, documents);
          }

          finalProducts.push(final);
        }

        return finalProducts;
      });

      const formatted = result.map((item) =>
        normalizeLenderProductForAdminApi(item, {
          documents: mapLenderDocumentRequirements(
            item.lenderDocumentRequirements,
          ),
        }),
      );

      return reply.send({
        success: true,
        message: "Products upserted successfully",
        count: formatted.length,
        data: formatted,
      });
    } catch (error) {
      adminLogs.error("UPSERT failed", error);

      if (String(error.message || "").startsWith("NOT_FOUND_")) {
        return reply.status(404).send({
          success: false,
          message: "One or more lender products were not found",
        });
      }

      if (String(error.message || "").startsWith("INVALID_OWNER_")) {
        return reply.status(403).send({
          success: false,
          message: "Lender product does not belong to this organization",
        });
      }

      if (String(error.message || "").startsWith("INVALID_LOAN_PRODUCT_")) {
        return reply.status(400).send({
          success: false,
          message: error.message,
        });
      }

      return reply.status(500).send({
        success: false,
        message: error.message || "Server error",
      });
    }
  });
}

module.exports = updateLenderProductRoutes;
