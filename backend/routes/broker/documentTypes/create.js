/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const {
  requireLoCustomDocumentsManage,
} = require("../../../services/broker/loanOfficerAccess");
const {
  resolveLoanProductsForBrokerDoc,
  syncDocumentTypeLoanProducts,
  mapLoanProductsFromRequirements,
} = require("../../../utils/documents/brokerCustomDocumentProducts");

async function createBrokerCustomDocumentType(fastify) {
  fastify.post(
    "/",
    {
      preHandler: async (req, reply) => {
        await requireLoCustomDocumentsManage(req, reply, fastify);
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user?.organizationId || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const name = String(req.body?.name || "").trim();
        const description = String(req.body?.description || "").trim();

        if (name.length < 2) {
          return reply.code(400).send({
            success: false,
            message: "Document name must be at least 2 characters",
          });
        }

        const productsResult = await resolveLoanProductsForBrokerDoc(
          prisma,
          req.body?.loanProductIds,
          req.body?.loanProductCode || req.body?.loanProductCodes,
        );
        if (!productsResult.ok) {
          return reply.code(productsResult.status).send({
            success: false,
            message: productsResult.message,
          });
        }

        const existing = await prisma.documentType.findFirst({
          where: {
            isCustom: true,
            createdByOrgId: brokerOrgId,
            isActive: true,
            name: { equals: name, mode: "insensitive" },
          },
          include: {
            productRequirements: {
              select: {
                loanProductId: true,
                loanProductCode: true,
                loanProduct: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
          },
        });

        if (existing) {
          // Idempotent: keep identity, ensure this product is linked (broker-private).
          const existingProducts = mapLoanProductsFromRequirements(
            existing.productRequirements || [],
          );
          const byId = new Map();
          for (const product of [
            ...existingProducts.filter((p) => p.id && p.code),
            ...productsResult.products,
          ]) {
            byId.set(product.id, {
              id: product.id,
              code: product.code,
              name: product.name || product.code,
            });
          }
          const mergedProducts = [...byId.values()];

          await prisma.$transaction(async (tx) => {
            await syncDocumentTypeLoanProducts(
              tx,
              existing.id,
              mergedProducts,
            );
          });

          return reply.send({
            success: true,
            message: "Custom document already exists for your brokerage",
            data: {
              ...existing,
              productRequirements: undefined,
              usageCount: 0,
              isProtected: false,
              loanProducts: mergedProducts,
              loanProductIds: mergedProducts.map((p) => p.id),
              reused: true,
            },
          });
        }

        const created = await prisma.$transaction(async (tx) => {
          const documentType = await tx.documentType.create({
            data: {
              name,
              description: description || null,
              isCustom: true,
              createdByOrgId: brokerOrgId,
              isActive: true,
            },
          });

          await syncDocumentTypeLoanProducts(
            tx,
            documentType.id,
            productsResult.products,
          );

          return documentType;
        });

        const loanProducts = productsResult.products.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
        }));

        return reply.code(201).send({
          success: true,
          message: "Custom document created",
          data: {
            ...created,
            usageCount: 0,
            isProtected: false,
            loanProducts,
            loanProductIds: loanProducts.map((p) => p.id),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to create custom document",
        });
      }
    },
  );
}

module.exports = createBrokerCustomDocumentType;
