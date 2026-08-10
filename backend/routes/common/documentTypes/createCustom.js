const {
  resolveLoanProductsForBrokerDoc,
  syncDocumentTypeLoanProducts,
} = require("../../../utils/documents/brokerCustomDocumentProducts");

/**
 * Create org-scoped custom document type (Broker / Lender).
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createCustomDocumentType(fastify) {
  fastify.post(
    "/create-custom",
    {
      schema: {
        tags: ["Common -> Document Types"],
        summary: "Create a custom document type for the current organization",
        body: {
          type: "object",
          required: ["name"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 2, maxLength: 120 },
            description: { type: "string", maxLength: 500 },
            loanProductId: { type: "string", format: "uuid" },
            loanProductIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        await fastify.authenticate(req, reply);

        if (
          !req.user?.organizationId ||
          !["BROKER", "LENDER"].includes(req.user.orgType)
        ) {
          return reply.code(403).send({
            success: false,
            message: "Broker or lender access only",
          });
        }

        const orgId = req.user.organizationId;
        const name = String(req.body?.name || "").trim();
        const description = String(req.body?.description || "").trim();
        const loanProductIdsRaw = Array.isArray(req.body?.loanProductIds)
          ? req.body.loanProductIds
          : req.body?.loanProductId
            ? [req.body.loanProductId]
            : [];

        if (name.length < 2) {
          return reply.code(400).send({
            success: false,
            message: "Document name must be at least 2 characters",
          });
        }

        let productsToLink = [];
        if (loanProductIdsRaw.length > 0) {
          const productsResult = await resolveLoanProductsForBrokerDoc(
            prisma,
            loanProductIdsRaw,
          );
          if (!productsResult.ok) {
            return reply.code(productsResult.status).send({
              success: false,
              message: productsResult.message,
            });
          }
          productsToLink = productsResult.products;

          // Expand Bridge/Construction aliases so product-scoped lists include them
          const {
            resolveLoanProductFilter,
          } = require("../../../utils/documents/brokerCustomDocumentProducts");
          const expanded = new Map();
          for (const product of productsToLink) {
            const resolved = await resolveLoanProductFilter(prisma, {
              loanProductId: product.id,
            });
            if (resolved?.ok) {
              for (const related of resolved.products || []) {
                expanded.set(related.id, related);
              }
            } else {
              expanded.set(product.id, product);
            }
          }
          productsToLink = [...expanded.values()];
        }

        const existing = await prisma.documentType.findFirst({
          where: {
            isActive: true,
            isCustom: true,
            createdByOrgId: orgId,
            name: {
              equals: name,
              mode: "insensitive",
            },
          },
        });

        if (existing) {
          if (productsToLink.length > 0 && req.user.orgType === "BROKER") {
            const currentLinks =
              await prisma.productDocumentRequirement.findMany({
                where: { documentTypeId: existing.id },
                select: { loanProductId: true, loanProductCode: true },
              });
            const linkedIds = new Set(
              currentLinks.map((row) => row.loanProductId).filter(Boolean),
            );
            const missing = productsToLink.filter((p) => !linkedIds.has(p.id));
            if (missing.length > 0) {
              await prisma.productDocumentRequirement.createMany({
                data: missing.map((product) => ({
                  documentTypeId: existing.id,
                  loanProductId: product.id,
                  loanProductCode: product.code,
                  isRequired: true,
                })),
              });
            }
          }

          return reply.send({
            success: true,
            message: "Custom document already exists",
            data: existing,
          });
        }

        const created = await prisma.$transaction(async (tx) => {
          const documentType = await tx.documentType.create({
            data: {
              name,
              description: description || null,
              isCustom: true,
              createdByOrgId: orgId,
              isActive: true,
            },
          });

          if (productsToLink.length > 0 && req.user.orgType === "BROKER") {
            await syncDocumentTypeLoanProducts(
              tx,
              documentType.id,
              productsToLink,
            );
          }

          return documentType;
        });

        return reply.code(201).send({
          success: true,
          message: "Custom document created",
          data: created,
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, stack: error.stack },
          "Create custom document type failed",
        );
        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
}

module.exports = createCustomDocumentType;
