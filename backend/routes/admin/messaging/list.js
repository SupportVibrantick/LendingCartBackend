async function listConversations(fastify) {
  fastify.get(
    "/conversations",
    {
      schema: {
        tags: ["Admin -> Communications"],
        summary: "List all platform conversations",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const q = req.query || {};
      const page = Math.max(parseInt(q.page || "1", 10), 1);
      const limit = Math.min(Math.max(parseInt(q.limit || "20", 10), 1), 100);
      const skip = (page - 1) * limit;

      const where = {};
      if (q.type) where.type = q.type;
      if (q.brokerOrgId) {
        where.loanApplicationId = {
          in: (
            await prisma.loanApplication.findMany({
              where: { brokerOrgId: q.brokerOrgId },
              select: { id: true },
            })
          ).map((row) => row.id),
        };
      }

      const [conversations, total] = await prisma.$transaction([
        prisma.conversation.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                text: true,
                senderName: true,
                senderType: true,
                createdAt: true,
              },
            },
            _count: { select: { messages: true, participants: true } },
          },
        }),
        prisma.conversation.count({ where }),
      ]);

      const appIds = [
        ...new Set(
          conversations
            .map((item) => item.loanApplicationId)
            .filter((id) => typeof id === "string" && id.length > 0),
        ),
      ];

      const applications = appIds.length
        ? await prisma.loanApplication.findMany({
            where: { id: { in: appIds } },
            select: {
              id: true,
              applicationNumber: true,
              brokerOrgId: true,
              brokerOrg: { select: { name: true } },
              client: { select: { legalName: true } },
            },
          })
        : [];

      const appMap = new Map(applications.map((app) => [app.id, app]));

      return reply.send({
        success: true,
        data: conversations.map((conv) => {
          const app = appMap.get(conv.loanApplicationId);
          const lastMessage = conv.messages[0] || null;
          return {
            id: conv.id,
            type: conv.type,
            chatCategory: conv.chatCategory,
            lastMessageAt: conv.lastMessageAt || lastMessage?.createdAt || conv.createdAt,
            messageCount: conv._count.messages,
            participantCount: conv._count.participants,
            applicationId: conv.loanApplicationId,
            applicationNumber: app?.applicationNumber || null,
            brokerOrgId: app?.brokerOrgId || null,
            brokerName: app?.brokerOrg?.name || null,
            clientName: app?.client?.legalName || null,
            lastMessage,
          };
        }),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );

  fastify.get(
    "/conversations/:conversationId/messages",
    {
      schema: {
        tags: ["Admin -> Communications"],
        summary: "Read messages for any conversation (platform admin)",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { conversationId } = req.params;
      const q = req.query || {};
      const page = Math.max(parseInt(q.page || "1", 10), 1);
      const limit = Math.min(Math.max(parseInt(q.limit || "50", 10), 1), 200);
      const skip = (page - 1) * limit;

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        return reply.code(404).send({ success: false, message: "Conversation not found" });
      }

      const [messages, total] = await prisma.$transaction([
        prisma.message.findMany({
          where: { conversationId },
          skip,
          take: limit,
          orderBy: { createdAt: "asc" },
        }),
        prisma.message.count({ where: { conversationId } }),
      ]);

      return reply.send({
        success: true,
        data: {
          conversation: {
            id: conversation.id,
            type: conversation.type,
            loanApplicationId: conversation.loanApplicationId,
          },
          messages,
        },
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );
}

module.exports = listConversations;
