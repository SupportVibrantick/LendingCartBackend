const {
  getValidInvite,
} = require("../../../services/broker/brokerTeamInvite.service");

module.exports = async function validateBrokerTeamInviteRoute(fastify) {
  fastify.get(
    "/:token",
    {
      schema: {
        tags: ["Public -> Broker Team Invites"],
        summary: "Validate a public LO / Co-Broker join invite token",
        params: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" },
          },
        },
      },
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "15 minute",
        },
      },
    },
    async (req, reply) => {
      try {
        const invite = await getValidInvite(
          fastify.prisma,
          req.params.token,
        );

        if (!invite) {
          return reply.send({
            success: true,
            data: { valid: false },
          });
        }

        return reply.send({
          success: true,
          data: {
            valid: true,
            role: invite.role,
            organizationName: invite.organization.name,
            expiresAt: invite.expiresAt,
          },
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message },
          "Validate broker team invite failed",
        );
        return reply.code(500).send({
          success: false,
          message: "Unable to validate invite link",
        });
      }
    },
  );
};
