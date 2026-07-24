/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function deleteLenderDocumentConfigRoutes(fastify) {
  const {
    deactivateOrphanedCustomDocumentType,
  } = require("../../../utils/documents/customDocumentTypeCleanup");

  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Lender -> Document Config"],
        summary: "Delete document config",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= AUTH ================= */
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { id } = req.params;

        /* ================= FIND CONFIG ================= */
        const existing = await prisma.lenderDocumentRequirement.findUnique({
          where: { id },
          include: {
            lenderProduct: {
              select: { lenderOrgId: true },
            },
            documentType: {
              select: {
                id: true,
                isCustom: true,
                createdByOrgId: true,
              },
            },
          },
        });

        if (!existing) {
          return reply.code(404).send({
            success: false,
            message: "Document config not found",
          });
        }

        /* ================= OWNERSHIP CHECK ================= */
        if (existing.lenderProduct.lenderOrgId !== lenderOrgId) {
          return reply.code(403).send({
            success: false,
            message: "You do not have access to this config",
          });
        }

        /* ================= DELETE ================= */
        await prisma.lenderDocumentRequirement.delete({
          where: { id },
        });

        let customTypeDeactivated = false;
        if (existing.documentType?.isCustom) {
          customTypeDeactivated = await deactivateOrphanedCustomDocumentType(
            prisma,
            existing.documentType.id,
            lenderOrgId,
          );
        }

        return reply.send({
          success: true,
          message: customTypeDeactivated
            ? "Document requirement and unused custom document type removed"
            : "Document config deleted successfully",
          data: { customTypeDeactivated },
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            id: req.params.id,
            user: req.user,
          },
          "❌ Delete document config failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
}

module.exports = deleteLenderDocumentConfigRoutes;