function normalizeSearch(search) {
  return typeof search === "string" ? search.trim().toLowerCase() : "";
}

function getConversationSearchFields(item) {
  return [
    item.title,
    item.displayName,
    item.brokerName,
    item.officerName,
    item.clientName,
    item.lenderName,
    item.lastMessage,
    item.participant?.name,
    item.participantSummary,
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
}

function conversationMatchesSearch(item, search) {
  if (!search) return true;
  return getConversationSearchFields(item).some((field) => field.includes(search));
}

async function getConversationIdsMatchingMessageSearch(prisma, loanId, search) {
  const matches = await prisma.message.findMany({
    where: {
      conversation: { loanApplicationId: loanId },
      text: { contains: search, mode: "insensitive" },
    },
    select: { conversationId: true },
    distinct: ["conversationId"],
  });

  return new Set(matches.map((row) => row.conversationId));
}

async function filterLoanConversationsBySearch(
  prisma,
  loanId,
  conversations,
  search,
) {
  const normalized = normalizeSearch(search);
  if (!normalized) return conversations;

  const messageMatchIds = await getConversationIdsMatchingMessageSearch(
    prisma,
    loanId,
    search.trim(),
  );

  return conversations.filter((item) => {
    if (conversationMatchesSearch(item, normalized)) {
      return true;
    }

    return Boolean(item.id && messageMatchIds.has(item.id));
  });
}

module.exports = {
  filterLoanConversationsBySearch,
  normalizeSearch,
};
