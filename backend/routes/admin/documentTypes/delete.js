const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  deleteDocumentTypeSchema,
} = require("../../../schemas/admin/documentTypes/delete.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function deleteDocumentTypeRoutes(fastify) {
  fastify.delete(
    "/",
    {
      schema: {
        tags: ["Admin -> Document Types"],
        summary: "Delete Document Type / unlink from loan product",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const parsed = deleteDocumentTypeSchema.safeParse(req.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const { id, loanProductId } = parsed.data;

        const exists = await prisma.documentType.findUnique({ where: { id } });
        if (!exists) {
          return reply.status(404).send({
            success: false,
            message: "Document type not found",
          });
        }

        // Product-scoped delete: unlink from product, then delete type if unused.
        if (loanProductId) {
          const requirement =
            await prisma.productDocumentRequirement.findFirst({
              where: { documentTypeId: id, loanProductId },
            });

          if (!requirement) {
            return reply.status(404).send({
              success: false,
              message: "Document is not linked to this loan product",
            });
          }

          await prisma.productDocumentRequirement.delete({
            where: { id: requirement.id },
          });

          const [
            productRequirementCount,
            lenderRequirementCount,
            lenderRequestCount,
            applicationRequirementCount,
          ] = await Promise.all([
            prisma.productDocumentRequirement.count({
              where: { documentTypeId: id },
            }),
            prisma.lenderDocumentRequirement.count({
              where: { documentTypeId: id },
            }),
            prisma.lenderDocumentRequest.count({
              where: { documentTypeId: id },
            }),
            prisma.applicationDocumentRequirement.count({
              where: { documentTypeId: id },
            }),
          ]);

          const stillInUse =
            productRequirementCount +
              lenderRequirementCount +
              lenderRequestCount +
              applicationRequirementCount >
            0;

          if (!stillInUse) {
            await prisma.documentType.delete({ where: { id } });
          }

          adminLogs.info("Document type unlinked from loan product", {
            documentTypeId: id,
            loanProductId,
            deletedType: !stillInUse,
          });

          return reply.send({
            success: true,
            message: stillInUse
              ? "Document removed from this loan product"
              : "Document deleted successfully",
          });
        }

        const [
          productRequirementCount,
          lenderRequirementCount,
          lenderRequestCount,
          applicationRequirementCount,
        ] = await Promise.all([
          prisma.productDocumentRequirement.count({
            where: { documentTypeId: id },
          }),
          prisma.lenderDocumentRequirement.count({
            where: { documentTypeId: id },
          }),
          prisma.lenderDocumentRequest.count({
            where: { documentTypeId: id },
          }),
          prisma.applicationDocumentRequirement.count({
            where: { documentTypeId: id },
          }),
        ]);

        const inUseCount =
          productRequirementCount +
          lenderRequirementCount +
          lenderRequestCount +
          applicationRequirementCount;

        if (inUseCount > 0) {
          return reply.status(409).send({
            success: false,
            message:
              "This document type is in use and cannot be deleted. Deactivate it instead.",
          });
        }

        await prisma.documentType.delete({ where: { id } });

        adminLogs.info("Document type deleted", {
          documentTypeId: id,
          name: exists.name,
        });

        return reply.send({
          success: true,
          message: "Document type deleted successfully",
        });
      } catch (error) {
        adminLogs.error("DocumentType delete failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while deleting document type",
        });
      }
    },
  );
}

module.exports = deleteDocumentTypeRoutes;
