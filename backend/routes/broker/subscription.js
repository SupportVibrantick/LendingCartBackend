const {
  getClmSubscriptionStatus,
  discontinueClmSoftTrial,
} = require("../../services/subscription/clmDiscontinue");

async function brokerSubscriptionRoutes(fastify) {
  fastify.get(
    "/status",
    {
      schema: {
        tags: ["Broker -> Subscription"],
        summary: "CLM / soft-trial subscription status for banner + Discontinue",
      },
    },
    async (req, reply) => {
      try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
          return reply.code(400).send({
            success: false,
            message: "Organization missing",
          });
        }

        const data = await getClmSubscriptionStatus(
          fastify.prisma,
          organizationId,
        );
        return reply.send({ success: true, data });
      } catch (err) {
        req.log.error(err);
        return reply.code(500).send({
          success: false,
          message: "Failed to load subscription status",
        });
      }
    },
  );

  fastify.post(
    "/discontinue",
    {
      schema: {
        tags: ["Broker -> Subscription"],
        summary:
          "Discontinue CLM soft-trial access (stops GHL billing request + locks until subscribe)",
      },
    },
    async (req, reply) => {
      try {
        const organizationId = req.user?.organizationId;
        const actorUserId = req.user?.userId;
        if (!organizationId) {
          return reply.code(400).send({
            success: false,
            message: "Organization missing",
          });
        }

        const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
        if (!roles.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            code: "FORBIDDEN",
            message: "Only the broker admin can discontinue Loan Automation.",
          });
        }

        const result = await discontinueClmSoftTrial(fastify.prisma, {
          organizationId,
          actorUserId,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err) {
        const status = err.statusCode || 500;
        req.log.error(err);
        return reply.code(status).send({
          success: false,
          code: err.code || "CLM_DISCONTINUE_FAILED",
          message: err.message || "Failed to discontinue",
        });
      }
    },
  );
}

module.exports = brokerSubscriptionRoutes;
