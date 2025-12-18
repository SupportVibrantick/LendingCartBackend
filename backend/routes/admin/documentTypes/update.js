const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
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
      try {
        const parsed = updateDocumentTypeSchema.safeParse(req.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const { id, name, description } = parsed.data;

        const exists = await prisma.documentType.findUnique({ where: { id } });
        if (!exists) {
          return reply.status(404).send({
            success: false,
            message: "Document type not found",
          });
        }

        const updated = await prisma.documentType.update({
          where: { id },
          data: {
            name,
            description: description ?? null,
          },
        });

        adminLogs.info("Document type updated", { id });

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
    }
  );
}

module.exports = updateDocumentTypeRoutes;
