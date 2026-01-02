/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function toggleBrokerStatusRoutes(fastify) {
  fastify.patch(
    "/:brokerOrgId/status",
    {
      schema: {
        tags: ["Lender -> Brokers"],
        summary: "Enable or disable broker for this lender",
        description: "Temporarily enable or disable a broker ONLY for this lender",
        params: {
          type: "object",
          required: ["brokerOrgId"],
          properties: {
            brokerOrgId: { type: "string", format: "uuid" },
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
        // Auth safety
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
        const { brokerOrgId } = req.params;
        const { isActive } = req.body;

        // ---------------------------
        // Validate lender–broker relationship
        // ---------------------------
        const access = await prisma.brokerLenderAccess.findFirst({
          where: {
            lenderOrgId,
            brokerOrgId,
          },
        });

        if (!access) {
          return reply.status(404).send({
            success: false,
            message: "Broker not connected to this lender",
          });
        }

        // ---------------------------
        // Prevent redundant updates (IMPORTANT)
        // ---------------------------
        if (access.isActive === isActive) {
          return reply.status(409).send({
            success: false,
            message: isActive
              ? "Broker is already enabled for this lender"
              : "Broker is already disabled for this lender",
          });
        }

        // ---------------------------
        // Toggle lender-level access ONLY
        // ---------------------------
        const updated = await prisma.brokerLenderAccess.update({
          where: { id: access.id },
          data: { isActive },
        });

        return reply.send({
          success: true,
          data: {
            brokerOrgId,
            connectionStatus: updated.isActive
              ? "CONNECTED"
              : "DISABLED",
          },
          message: updated.isActive
            ? "Broker enabled for this lender"
            : "Broker disabled for this lender",
        });
      } catch (error) {
        req.log.error(error);

        return reply.status(500).send({
          success: false,
          message: "Server error while updating broker status",
        });
      }
    }
  );
}

module.exports = toggleBrokerStatusRoutes;
