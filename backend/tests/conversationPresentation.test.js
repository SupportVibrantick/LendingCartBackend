const test = require("node:test");
const assert = require("node:assert/strict");
const {
  enrichConversationItem,
} = require("../services/messaging/conversationPresentation");

test("broker viewer sees distinct co-broker channel labels", () => {
  const principal = enrichConversationItem(
    {
      id: "conv-1",
      type: "SUBBROKER_BROKER",
      chatCategory: "PRINCIPAL_BROKER",
      subBrokerName: "Maria Gonzalez",
      participant: { name: "Maria Gonzalez", role: "SUB_BROKER" },
    },
    "BROKER",
  );

  const loChannel = enrichConversationItem(
    {
      id: "conv-2",
      type: "SUBBROKER_BROKER",
      chatCategory: "LOAN_OFFICER",
      subBrokerName: "Maria Gonzalez",
      loanOfficerName: "James Carter",
      participant: { name: "Maria Gonzalez", role: "SUB_BROKER" },
    },
    "BROKER",
  );

  assert.equal(principal.displayName, "Maria Gonzalez");
  assert.equal(principal.badgeLabel, "Co-Broker");

  assert.equal(loChannel.displayName, "Maria Gonzalez → James Carter");
  assert.equal(loChannel.badgeLabel, "Co-Broker · LO");
  assert.notEqual(principal.displayName, loChannel.displayName);
});

test("loan officer lender thread shows Lender badge not LO channel label", () => {
  const item = enrichConversationItem(
    {
      id: "conv-lender",
      type: "BROKER_LENDER",
      chatCategory: "LOAN_OFFICER",
      lenderName: "LendingCart Lender",
      title: "Lender - LendingCart Lender",
    },
    "LOAN_OFFICER",
  );

  assert.equal(item.displayName, "LendingCart Lender");
  assert.equal(item.badgeLabel, "Lender");
  assert.equal(item.badgeTone, "indigo");
});
