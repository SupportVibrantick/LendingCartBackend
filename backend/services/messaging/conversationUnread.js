function normalizeEmail(email) {
  return email?.trim().toLowerCase();
}

function isRealConversationId(id) {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-f-]{36}$/i.test(id);
}

function findParticipant(conversation, userId, userEmail) {
  const participants = conversation?.participants || [];
  const normalizedEmail = normalizeEmail(userEmail);

  return participants.find(
    (p) =>
      p.participantId === userId ||
      (normalizedEmail &&
        normalizeEmail(p.participantEmail) === normalizedEmail),
  );
}

async function countUnreadMessages(
  prisma,
  { conversationId, userId, lastReadAt },
) {
  if (!conversationId || !userId) return 0;

  return prisma.message.count({
    where: {
      conversationId,
      ...(lastReadAt && {
        createdAt: { gt: lastReadAt },
      }),
      NOT: {
        OR: [{ senderUserId: userId }, { senderClientUserId: userId }],
      },
    },
  });
}

async function getConversationUnreadMeta(
  prisma,
  conversation,
  { userId, userEmail },
) {
  if (!conversation?.id || !userId || !isRealConversationId(conversation.id)) {
    return { unread: false, unreadCount: 0 };
  }

  let participation = findParticipant(conversation, userId, userEmail);

  if (!participation) {
    participation = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: conversation.id,
        OR: [
          { participantId: userId },
          userEmail
            ? { participantEmail: normalizeEmail(userEmail) }
            : undefined,
        ].filter(Boolean),
      },
      select: { lastReadAt: true },
    });
  }

  const unreadCount = await countUnreadMessages(prisma, {
    conversationId: conversation.id,
    userId,
    lastReadAt: participation?.lastReadAt,
  });

  return { unread: unreadCount > 0, unreadCount };
}

async function enrichLoanConversationItems(
  prisma,
  { items, conversations, userId, userEmail },
) {
  const convMap = new Map((conversations || []).map((c) => [c.id, c]));

  return Promise.all(
    (items || []).map(async (item) => {
      if (item.isPlaceholder || !isRealConversationId(item.id)) {
        return { ...item, unread: false, unreadCount: 0 };
      }

      const conv = convMap.get(item.id) || { id: item.id, participants: [] };
      const meta = await getConversationUnreadMeta(prisma, conv, {
        userId,
        userEmail,
      });

      return { ...item, ...meta };
    }),
  );
}

module.exports = {
  normalizeEmail,
  isRealConversationId,
  countUnreadMessages,
  getConversationUnreadMeta,
  enrichLoanConversationItems,
};
