const {
  createBrokerTeamInvite,
} = require("../../../services/broker/brokerTeamInvite.service");

module.exports = async function createBrokerTeamInviteRoute(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Broker -> Team Invites"],
        summary: "Create a time-limited public join invite for LO or Co-Broker",
        body: {
          type: "object",
          required: ["role"],
          properties: {
            role: {
              type: "string",
              enum: ["LOAN_OFFICER", "SUB_BROKER"],
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const role = String(req.body?.role || "").trim().toUpperCase();
        if (role !== "LOAN_OFFICER" && role !== "SUB_BROKER") {
          return reply.code(400).send({
            success: false,
            message: "role must be LOAN_OFFICER or SUB_BROKER",
          });
        }

        const isBrokerAdmin = req.user.roles?.includes("BROKER_ADMIN");
        const isLoanOfficer = req.user.roles?.includes("BROKER_OFFICER");

        if (role === "LOAN_OFFICER" && !isBrokerAdmin) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can create loan officer invite links",
          });
        }

        if (role === "SUB_BROKER" && !isBrokerAdmin && !isLoanOfficer) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        if (role === "SUB_BROKER" && !isBrokerAdmin && isLoanOfficer) {
          const {
            requireLoOfficerPermission,
          } = require("../../../services/broker/loanOfficerAccess");
          await requireLoOfficerPermission(
            req,
            reply,
            fastify,
            "EDIT_CO_BROKERS",
          );
          if (reply.sent) return;
        }

        const invite = await createBrokerTeamInvite(fastify.prisma, {
          organizationId: req.user.organizationId,
          role,
          createdById: req.user.id,
        });

        return reply.send({
          success: true,
          message: "Invite link created",
          data: invite,
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message },
          "Create broker team invite failed",
        );
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to create invite link",
        });
      }
    },
  );
};
