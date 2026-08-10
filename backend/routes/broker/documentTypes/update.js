/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const {
  requireLoCustomDocumentsManage,
} = require("../../../services/broker/loanOfficerAccess");
const {
  resolveLoanProductsForBrokerDoc,
  syncDocumentTypeLoanProducts,
} = require("../../../utils/documents/brokerCustomDocumentProducts");

async function updateBrokerCustomDocumentType(fastify) {
  fastify.put(
    "/:id",
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
        const { id } = req.params;
        const name =
          req.body?.name !== undefined
            ? String(req.body.name).trim()
            : undefined;
        const description =
          req.body?.description !== undefined
            ? String(req.body.description).trim()
            : undefined;
        const hasLoanProductIds = Object.prototype.hasOwnProperty.call(
          req.body || {},
          "loanProductIds",
        );

        const existing = await prisma.documentType.findFirst({
          where: {
            id,
            isCustom: true,
            createdByOrgId: brokerOrgId,
          },
        });

        if (!existing) {
          return reply.code(404).send({
            success: false,
            message: "Custom document not found",
          });
        }

        if (existing.code === "BROKER_LOI_TERM_SHEET") {
          return reply.code(400).send({
            success: false,
            message: "This system document cannot be edited",
          });
        }

        if (name !== undefined && name.length < 2) {
          return reply.code(400).send({
            success: false,
            message: "Document name must be at least 2 characters",
          });
        }

        let productsResult = null;
        if (hasLoanProductIds) {
          productsResult = await resolveLoanProductsForBrokerDoc(
            prisma,
            req.body.loanProductIds,
          );
          if (!productsResult.ok) {
            return reply.code(productsResult.status).send({
              success: false,
              message: productsResult.message,
            });
          }
        }

        if (name) {
          const duplicate = await prisma.documentType.findFirst({
            where: {
              id: { not: id },
              isCustom: true,
              createdByOrgId: brokerOrgId,
              isActive: true,
              name: { equals: name, mode: "insensitive" },
            },
          });

          if (duplicate) {
            return reply.code(409).send({
              success: false,
              message: "Another custom document already uses this name",
            });
          }
        }

        const updated = await prisma.$transaction(async (tx) => {
          const documentType = await tx.documentType.update({
            where: { id },
            data: {
              ...(name !== undefined ? { name } : {}),
              ...(description !== undefined
                ? { description: description || null }
                : {}),
            },
          });

          if (productsResult) {
            await syncDocumentTypeLoanProducts(
              tx,
              id,
              productsResult.products,
            );
          }

          return documentType;
        });

        const requirements = await prisma.productDocumentRequirement.findMany({
          where: { documentTypeId: id },
          select: {
            loanProductId: true,
            loanProductCode: true,
            loanProduct: { select: { id: true, code: true, name: true } },
          },
        });

        const loanProducts = requirements.map((row) => ({
          id: row.loanProduct?.id || row.loanProductId || null,
          code: row.loanProduct?.code || row.loanProductCode,
          name: row.loanProduct?.name || row.loanProductCode,
        }));

        const usageCount = await prisma.applicationDocumentRequirement.count({
          where: {
            documentTypeId: id,
            loanApplication: { brokerOrgId },
          },
        });

        return reply.send({
          success: true,
          message: "Custom document updated",
          data: {
            ...updated,
            usageCount,
            isProtected: updated.code === "BROKER_LOI_TERM_SHEET",
            loanProducts,
            loanProductIds: loanProducts.map((p) => p.id).filter(Boolean),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to update custom document",
        });
      }
    },
  );
}

module.exports = updateBrokerCustomDocumentType;
