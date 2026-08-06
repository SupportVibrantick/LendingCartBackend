const {
  getOrganizationId,
  getUserId,
  isBrokerSideUser,
  isLenderUser,
} = require("../../../../services/messaging/messagingAccess");
const { hasLenderPermission, LENDER_PERMISSION } = require("../../../../utils/lender/lenderPermissions");
const {
  ensureNetworkBrokerLenderConversation,
  NETWORK_CHAT_CATEGORY,
} = require("../../../../services/messaging/networkBrokerLenderConversation");

module.exports = async function createNetworkConversation(fastify) {
  fastify.post(
    "/network-conversation",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Messaging"],
        summary:
          "Create or resolve org-level broker↔lender network chat (Marketplace)",
        body: {
          type: "object",
          properties: {
            lenderOrgId: { type: "string", format: "uuid" },
            brokerOrgId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const userId = getUserId(req.user);
        const orgId = getOrganizationId(req.user);
        const isBroker = isBrokerSideUser({ user: req.user });
        const isLender = isLenderUser({ user: req.user });

        if (!isBroker && !isLender) {
          return reply.code(403).send({
            success: false,
            message: "Broker or lender access only",
          });
        }

        if (isLender && !hasLenderPermission(req.user, LENDER_PERMISSION.SEND_CHAT)) {
          return reply.code(403).send({
            success: false,
            message: "You do not have permission to start conversations.",
          });
        }

        if (!orgId) {
          return reply.code(403).send({
            success: false,
            message: "Organization not found",
          });
        }

        let brokerOrgId;
        let lenderOrgId;

        if (isBroker) {
          brokerOrgId = orgId;
          lenderOrgId = req.body?.lenderOrgId;
          if (!lenderOrgId) {
            return reply.code(400).send({
              success: false,
              message: "lenderOrgId is required",
            });
          }
        } else {
          lenderOrgId = orgId;
          brokerOrgId = req.body?.brokerOrgId;
          if (!brokerOrgId) {
            return reply.code(400).send({
              success: false,
              message: "brokerOrgId is required",
            });
          }
        }

        const { conversation, brokerOrg, lenderOrg } =
          await ensureNetworkBrokerLenderConversation(prisma, {
            brokerOrgId,
            lenderOrgId,
            createdByUserId: isBroker ? userId : null,
          });

        const counterpart =
          isBroker
            ? {
                orgId: lenderOrg?.id || lenderOrgId,
                name: lenderOrg?.name || "Lender",
                role: "LENDER",
              }
            : {
                orgId: brokerOrg?.id || brokerOrgId,
                name: brokerOrg?.name || "Broker",
                role: "BROKER",
              };

        return reply.send({
          success: true,
          message: "Network conversation ready",
          data: {
            id: conversation.id,
            type: conversation.type,
            chatCategory: conversation.chatCategory || NETWORK_CHAT_CATEGORY,
            brokerLenderAccessId: conversation.brokerLenderAccessId,
            counterpart,
          },
        });
      } catch (error) {
        const status = error.statusCode || 500;
        if (status >= 500) {
          fastify.log.error(error);
        }
        return reply.code(status).send({
          success: false,
          message: error.message || "Failed to create network conversation",
        });
      }
    },
  );
};
