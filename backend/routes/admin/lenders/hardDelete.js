// routes/admin/lenders/hardDelete.js

const { adminLogs } = require("../../../services/logger/contextLogger");
const { hardDeleteLenderOrg } = require("../../../services/lenders/hardDeleteLender");

/**
 * Permanent Hard Delete (ops / after soft-delete retention).
 */
async function hardDeleteLenderRoutes(fastify) {
  fastify.delete(
    "/:lenderOrgId/hard",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "⚠️ HARD DELETE lender (permanent wipe)",
        params: {
          type: "object",
          required: ["lenderOrgId"],
          properties: {
            lenderOrgId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const { lenderOrgId } = request.params;

      try {
        await hardDeleteLenderOrg(prisma, lenderOrgId);

        adminLogs.warn("LENDER HARD DELETED", { lenderOrgId });

        return reply.send({
          success: true,
          message: "Lender permanently deleted.",
        });
      } catch (error) {
        adminLogs.error("Hard delete failed", error);

        const status = error?.statusCode || 500;
        return reply.status(status).send({
          success: false,
          message:
            status === 404
              ? "Lender not found."
              : "Hard delete failed.",
          error: error.message,
        });
      }
    },
  );
}

module.exports = hardDeleteLenderRoutes;
