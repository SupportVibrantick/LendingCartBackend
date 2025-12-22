const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function toggleLenderLoanProductStatusRoutes(fastify) {
  fastify.patch(
    "/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Lender -> Loan Products"],
        summary: "Toggle Loan Product Status",
        description: "Enable or disable a lender loan product configuration",
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
      try {
        // ---------------------------
        // Auth check
        // ---------------------------
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { id } = req.params;

        // ---------------------------
        // Verify ownership
        // ---------------------------
        const existing = await prisma.lenderProduct.findFirst({
          where: {
            id,
            lenderOrgId,
          },
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            message: "Loan product configuration not found",
          });
        }

        // ---------------------------
        // Toggle status
        // ---------------------------
        const updated = await prisma.lenderProduct.update({
          where: { id },
          data: {
            isActive: !existing.isActive,
          },
        });

        return reply.send({
          success: true,
          message: `Loan product ${
            updated.isActive ? "activated" : "deactivated"
          } successfully`,
          data: updated,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          message: "Server error while toggling status",
        });
      }
    }
  );
}

module.exports = toggleLenderLoanProductStatusRoutes;
