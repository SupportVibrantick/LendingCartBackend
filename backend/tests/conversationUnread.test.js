const test = require("node:test");
const assert = require("node:assert/strict");

test("enrichLoanConversationItems sets accurate unread counts", async () => {
  const {
    enrichLoanConversationItems,
    isRealConversationId,
  } = require("../services/messaging/conversationUnread");

  assert.equal(isRealConversationId("broker-abc"), false);
  assert.equal(isRealConversationId("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"), true);

  const conversationId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const userId = "user-1";
  let countCalls = 0;

  const prisma = {
    message: {
      count: async ({ where }) => {
        countCalls += 1;
        assert.equal(where.conversationId, conversationId);
        return 2;
      },
    },
    conversationParticipant: {
      findFirst: async () => ({ lastReadAt: new Date("2026-01-01") }),
    },
  };

  const items = [
    {
      id: conversationId,
      type: "BROKER_LENDER",
      title: "Lender",
      isPlaceholder: false,
    },
    {
      id: "broker-placeholder",
      type: "BROKER_LENDER",
      isPlaceholder: true,
    },
  ];

  const conversations = [
    {
      id: conversationId,
      participants: [{ participantId: userId, lastReadAt: new Date("2026-01-01") }],
    },
  ];

  const enriched = await enrichLoanConversationItems(prisma, {
    items,
    conversations,
    userId,
    userEmail: "lo@example.com",
  });

  assert.equal(countCalls, 1);
  assert.equal(enriched[0].unreadCount, 2);
  assert.equal(enriched[0].unread, true);
  assert.equal(enriched[1].unreadCount, 0);
  assert.equal(enriched[1].unread, false);
});
