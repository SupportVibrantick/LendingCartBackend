const {
  cleanupOrphanedCustomDocumentTypes,
} = require("../../../utils/documents/customDocumentTypeCleanup");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function cleanupOrphanedCustomTypesRoutes(fastify) {
  fastify.post(
    "/cleanup-orphaned-custom-types",
    {
      schema: {
        tags: ["Lender -> Document Config"],
        summary: "Deactivate unused lender custom document types",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
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

        const result = await cleanupOrphanedCustomDocumentTypes(
          prisma,
          req.user.organizationId,
        );

        return reply.send({
          success: true,
          message: "Unused custom document types cleaned up",
          data: result,
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, stack: error.stack },
          "Cleanup orphaned custom document types failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
}

module.exports = cleanupOrphanedCustomTypesRoutes;
