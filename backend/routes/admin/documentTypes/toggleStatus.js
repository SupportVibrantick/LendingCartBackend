const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  toggleDocumentTypeStatusSchema,
} = require("../../../schemas/admin/documentTypes/status.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function toggleDocumentTypeStatusRoutes(fastify) {
  fastify.patch(
    "/",
    {
      schema: {
        tags: ["Admin -> Document Types"],
        summary: "Enable / Disable Document Type",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const parsed = toggleDocumentTypeStatusSchema.safeParse(req.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const { id, isActive } = parsed.data;

        const exists = await prisma.documentType.findUnique({ where: { id } });
        if (!exists) {
          return reply.status(404).send({
            success: false,
            message: "Document type not found",
          });
        }

        const updated = await prisma.documentType.update({
          where: { id },
          data: { isActive },
        });

        adminLogs.info("Document type status changed", {
          id,
          isActive,
        });

        return reply.send({
          success: true,
          message: "Document type status updated",
          data: updated,
        });
      } catch (error) {
        adminLogs.error("DocumentType status toggle failed", error);
        return reply.status(500).send({
          success: false,
          message: "Server error while updating status",
        });
      }
    }
  );
}

module.exports = toggleDocumentTypeStatusRoutes;
