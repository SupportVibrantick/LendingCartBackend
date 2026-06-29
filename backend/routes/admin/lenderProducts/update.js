// routes/admin/lenderProducts/update.js

const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  buildLenderProductPrismaFields,
} = require("../../../utils/buildLenderProductPrismaFields");
const {
  syncLenderProductDocuments,
} = require("../../../utils/syncLenderProductDocuments");

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
      // HELPERS
      // ---------------------------

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

          const productCode =
            existing?.loanProductCode || item.loanProductCode;

          const { documents, ...productInput } = item;

          const payload = buildLenderProductPrismaFields({
            ...productInput,
            loanProductCode: productCode,
          });

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

          if (Array.isArray(documents)) {
            await syncLenderProductDocuments(tx, final.id, documents);
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