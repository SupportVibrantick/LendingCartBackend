const test = require("node:test");
const assert = require("node:assert/strict");

test("clients only access principal CLIENT_BROKER conversation type", () => {
  const {
    assertConversationTypeAccess,
    assertCanSendMessage,
  } = require("../services/messaging/messagingAccess");

  const clientReq = {
    user: {
      orgType: "CLIENT",
      clientId: "client-1",
      role: "CLIENT",
    },
  };

  assert.equal(assertConversationTypeAccess(clientReq, "CLIENT_BROKER"), null);
  assert.equal(assertCanSendMessage(clientReq, "CLIENT_BROKER"), null);

  const officerDenied = assertConversationTypeAccess(
    clientReq,
    "CLIENT_OFFICER",
  );
  assert.equal(officerDenied?.code, 403);

  const sendDenied = assertCanSendMessage(clientReq, "CLIENT_OFFICER");
  assert.equal(sendDenied?.code, 403);
});

test("client team channel categories are identifiable", () => {
  const {
    buildClientCoBrokerCategory,
    isCoBrokerClientChannel,
    isPrincipalClientBrokerChannel,
  } = require("../services/messaging/brokerOfficerConversation");

  const category = buildClientCoBrokerCategory("sub-1");
  assert.equal(category, "CO_BROKER:sub-1");
  assert.equal(isCoBrokerClientChannel(category), true);
  assert.equal(isPrincipalClientBrokerChannel(null), true);
  assert.equal(isPrincipalClientBrokerChannel(category), false);
});

test("loan officers can access principal CLIENT_BROKER team channel", () => {
  const {
    getLoanOfficerConversationListFilters,
    assertLoanOfficerConversationScope,
  } = require("../services/messaging/messagingAccess");

  const filters = getLoanOfficerConversationListFilters();
  assert.ok(filters.OR[0].type.in.includes("CLIENT_BROKER"));

  const officerReq = {
    user: {
      roles: ["BROKER_OFFICER"],
      role: "BROKER_OFFICER",
      orgType: "BROKER",
    },
  };

  assert.equal(
    assertLoanOfficerConversationScope(officerReq, {
      type: "CLIENT_BROKER",
      chatCategory: "PRINCIPAL_BROKER",
    }),
    null,
  );
});

test("loan officer client thread filter prefers team channel", () => {
  const { filterLoanOfficerClientThreads } = require("../services/messaging/brokerOfficerConversation");

  const loanId = "loan-1";
  const filtered = filterLoanOfficerClientThreads([
    {
      id: "team",
      type: "CLIENT_BROKER",
      chatCategory: "PRINCIPAL_BROKER",
      loanApplicationId: loanId,
    },
    {
      id: "legacy",
      type: "CLIENT_OFFICER",
      loanApplicationId: loanId,
    },
  ]);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "team");
});

test("client viewer sees Your Broker Team badge", () => {
  const { enrichConversationItem } = require("../services/messaging/conversationPresentation");

  const item = enrichConversationItem(
    {
      id: "conv-1",
      type: "CLIENT_BROKER",
      brokerName: "Acme Lending",
      title: "Your Broker Team • Acme Lending",
    },
    "CLIENT",
  );

  assert.equal(item.displayName, "Acme Lending");
  assert.equal(item.badgeLabel, "Your Broker Team");
});
