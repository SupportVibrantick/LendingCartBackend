/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function toggleLenderStatusRoutes(fastify) {
  fastify.patch(
    "/:lenderOrgId/status",
    {
      schema: {
        tags: ["Broker -> Lenders"],
        summary: "Enable or disable lender for this broker",
        description: "Temporarily enable or disable a lender ONLY for this broker",
        params: {
          type: "object",
          required: ["lenderOrgId"],
          properties: {
            lenderOrgId: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["isActive"],
          additionalProperties: false,
          properties: {
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // ---------------------------
        // Auth safety (CORRECT)
        // ---------------------------
        if (!req.user || !req.user.organizationId) {
          return reply.status(403).send({
            success: false,
            message: "Unauthorized",
          });
        }

        // Validate broker organization
        const brokerOrg = await prisma.organization.findFirst({
          where: {
            id: req.user.organizationId,
            type: "BROKER",
            isDeleted: { not: true },
          },
          select: { id: true },
        });

        if (!brokerOrg) {
          return reply.status(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = brokerOrg.id;
        const { lenderOrgId } = req.params;
        const { isActive } = req.body;

        // ---------------------------
        // Validate broker–lender relationship
        // ---------------------------
        const access = await prisma.brokerLenderAccess.findFirst({
          where: {
            brokerOrgId,
            lenderOrgId,
          },
        });

        if (!access) {
          return reply.status(404).send({
            success: false,
            message: "Lender not connected to this broker",
          });
        }

        // ---------------------------
        // Prevent redundant updates
        // ---------------------------
        if (access.isActive === isActive) {
          return reply.status(409).send({
            success: false,
            message: isActive
              ? "Lender is already enabled for this broker"
              : "Lender is already disabled for this broker",
          });
        }

        // ---------------------------
        // Toggle broker-level access ONLY
        // ---------------------------
        const updated = await prisma.brokerLenderAccess.update({
          where: { id: access.id },
          data: { isActive },
        });

        return reply.send({
          success: true,
          data: {
            lenderOrgId,
            connectionStatus: updated.isActive
              ? "CONNECTED"
              : "DISABLED",
          },
          message: updated.isActive
            ? "Lender enabled for this broker"
            : "Lender disabled for this broker",
        });
      } catch (error) {
        req.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Server error while updating lender status",
        });
      }
    }
  );
}

module.exports = toggleLenderStatusRoutes;
