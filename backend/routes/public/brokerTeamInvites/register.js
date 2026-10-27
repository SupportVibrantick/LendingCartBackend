const { logAudit } = require("../../../services/logger/auditLogger");
const {
  registerFromBrokerTeamInvite,
  sendJoinCredentialsEmail,
  validateBankingPayload,
} = require("../../../services/broker/brokerTeamInvite.service");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/brokerNotifications");

module.exports = async function registerBrokerTeamInviteRoute(fastify) {
  fastify.post(
    "/:token/register",
    {
      schema: {
        tags: ["Public -> Broker Team Invites"],
        summary: "Register via public LO / Co-Broker join invite (banking required)",
        params: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: [
            "firstName",
            "lastName",
            "email",
            "accountType",
            "partyName",
            "partyAddress",
            "partyTel",
            "partyEmail",
            "bankName",
            "bankTel",
            "accountName",
            "accountNumber",
            "abaRoutingNumber",
          ],
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            accountType: { type: "string", enum: ["PERSONAL", "BUSINESS"] },
            partyName: { type: "string" },
            partyAddress: { type: "string" },
            partyTel: { type: "string" },
            partyEmail: { type: "string", format: "email" },
            bankName: { type: "string" },
            bankTel: { type: "string" },
            accountName: { type: "string" },
            accountNumber: { type: "string" },
            abaRoutingNumber: { type: "string" },
          },
        },
      },
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 hr",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many join attempts. Please try again later.",
          }),
        },
      },
    },
    async (req, reply) => {
      try {
        const bankingResult = validateBankingPayload(req.body || {});
        if (bankingResult.error) {
          return reply.code(400).send({
            success: false,
            message: bankingResult.error,
          });
        }

        const registered = await registerFromBrokerTeamInvite(fastify.prisma, {
          token: req.params.token,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          phone: req.body.phone,
          banking: bankingResult.banking,
        });

        await logAudit({
          prisma: fastify.prisma,
          req,
          dashboard: "BROKER",
          category: "USER_MANAGEMENT",
          entityType: "UserAccount",
          entityId: registered.user.id,
          action:
            registered.role === "SUB_BROKER"
              ? "PUBLIC_JOIN_SUB_BROKER"
              : "PUBLIC_JOIN_BROKER_OFFICER",
          newValue: {
            email: registered.user.email,
            role: registered.role,
            organizationId: registered.organizationId,
            source: "PUBLIC_TEAM_INVITE",
          },
        });

        try {
          await sendJoinCredentialsEmail({
            role: registered.role,
            firstName: registered.user.firstName,
            email: registered.user.email,
            password: registered.tempPassword,
            organizationName: registered.organizationName,
            prisma: fastify.prisma,
          });
        } catch (mailErr) {
          fastify.log.error(
            {
              error: mailErr.message,
              userId: registered.user.id,
              role: registered.role,
            },
            "Public team join credentials email failed",
          );
        }

        try {
          const memberName =
            `${registered.user.firstName || ""} ${registered.user.lastName || ""}`.trim() ||
            registered.user.email;
          const isCoBroker = registered.role === "SUB_BROKER";
          const roleLabel = isCoBroker ? "Co-Broker" : "Loan Officer";

          await notifyBroker(fastify.prisma, fastify.io, {
            brokerOrgId: registered.organizationId,
            eventType: isCoBroker
              ? BROKER_NOTIFICATION_EVENTS.CO_BROKER_JOINED
              : BROKER_NOTIFICATION_EVENTS.LOAN_OFFICER_JOINED,
            category: "TEAM",
            subject: `New ${roleLabel} joined`,
            body: `${memberName} joined your team as a ${roleLabel} via invite link.`,
            metadata: {
              userId: registered.user.id,
              email: registered.user.email,
              role: registered.role,
              memberName,
              officerName: isCoBroker ? undefined : memberName,
              subBrokerName: isCoBroker ? memberName : undefined,
              source: "PUBLIC_TEAM_INVITE",
            },
          });
        } catch (notifyErr) {
          fastify.log.error(
            {
              error: notifyErr.message,
              userId: registered.user.id,
              role: registered.role,
            },
            "Public team join broker notification failed",
          );
        }

        return reply.send({
          success: true,
          message:
            "Account created. Check your email for temporary login credentials.",
          data: {
            email: registered.user.email,
            role: registered.role,
            organizationName: registered.organizationName,
          },
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message },
          "Public broker team register failed",
        );
        return reply.code(error.statusCode || 500).send({
          success: false,
          code: error.code,
          message: error.message || "Unable to complete registration",
        });
      }
    },
  );
};
