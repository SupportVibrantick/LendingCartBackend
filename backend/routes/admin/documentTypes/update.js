const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  updateDocumentTypeSchema,
} = require("../../../schemas/admin/documentTypes/update.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function updateDocumentTypeRoutes(fastify) {
  fastify.put(
    "/",
    {
      schema: {
        tags: ["Admin -> Document Types"],
        summary: "Update Document Type",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const parsed = updateDocumentTypeSchema.safeParse(req.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const { id, name, description, loanProductId, isRequired } =
          parsed.data;

        const exists = await prisma.documentType.findUnique({ where: { id } });
        if (!exists) {
          return reply.status(404).send({
            success: false,
            message: "Document type not found",
          });
        }

        if (loanProductId) {
          const duplicateOnProduct =
            await prisma.productDocumentRequirement.findFirst({
              where: {
                loanProductId,
                documentTypeId: { not: id },
                documentType: {
                  name: { equals: name.trim(), mode: "insensitive" },
                },
              },
            });

          if (duplicateOnProduct) {
            return reply.status(409).send({
              success: false,
              message: `Another document named "${name.trim()}" is already linked to this product`,
            });
          }
        }

        const updated = await prisma.$transaction(async (tx) => {
          const documentType = await tx.documentType.update({
            where: { id },
            data: {
              name: name.trim(),
              description: description?.trim() || null,
            },
          });

          if (loanProductId && typeof isRequired === "boolean") {
            await tx.productDocumentRequirement.updateMany({
              where: {
                documentTypeId: id,
                loanProductId,
              },
              data: { isRequired },
            });
          }

          return documentType;
        });

        adminLogs.info("Document type updated", { id, loanProductId });

        return reply.send({
          success: true,
          message: "Document type updated successfully",
          data: updated,
        });
      } catch (error) {
        adminLogs.error("DocumentType update failed", error);
        return reply.status(500).send({
          success: false,
          message: "Server error while updating document type",
        });
      }
    },
  );
}

module.exports = updateDocumentTypeRoutes;
