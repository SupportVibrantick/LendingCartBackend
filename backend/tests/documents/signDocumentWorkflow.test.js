const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  getSignDocumentWorkflow,
} = require("../../utils/documents/signDocumentWorkflow");

test("signature-only SENT_TO_CLIENT is with client for broker", () => {
  const workflow = getSignDocumentWorkflow({
    signMode: "SIGNATURE_ONLY",
    signStatus: "SENT_TO_CLIENT",
  });
  assert.equal(workflow.brokerBucket, "withClient");
  assert.equal(workflow.clientBucket, "actionRequired");
  assert.equal(workflow.emailPreset, "signatureRequired");
});

test("dynamic form with broker fields pending stays in awaitingYou", () => {
  const workflow = getSignDocumentWorkflow(
    { signMode: "DYNAMIC_FORM", signStatus: "SENT_TO_CLIENT" },
    {
      client: { complete: true, filled: 2, total: 2, required: 2 },
      broker: { complete: false, filled: 0, total: 1, required: 1 },
      all: { complete: false, filled: 2, total: 3, required: 3 },
    },
  );
  assert.equal(workflow.brokerBucket, "awaitingYou");
  assert.equal(workflow.clientBucket, "waitingOnBroker");
  assert.equal(workflow.signStatusLabel, "Broker fields pending");
});

test("completed form is ready to forward", () => {
  const workflow = getSignDocumentWorkflow(
    { signMode: "DYNAMIC_FORM", signStatus: "CLIENT_SIGNED" },
    {
      client: { complete: true },
      broker: { complete: true },
      all: { complete: true },
    },
  );
  assert.equal(workflow.brokerBucket, "readyToForward");
  assert.equal(workflow.lenderBucket, "inProgress");
  assert.equal(workflow.emailPreset, "formFillRequired");
});

test("lender copy uses second-person reviewed wording", () => {
  const {
    getViewerWorkflowCopy,
  } = require("../../utils/documents/signDocumentWorkflow");
  const workflow = getSignDocumentWorkflow({
    signMode: "DYNAMIC_FORM",
    signStatus: "LENDER_SEEN",
  });
  const copy = getViewerWorkflowCopy(workflow, {
    signStatus: "LENDER_SEEN",
    signMode: "DYNAMIC_FORM",
  }, "lender");

  assert.equal(copy.signStatusLabel, "Reviewed");
  assert.equal(copy.workflowHint, "You reviewed this completed form");
});

test("awaiting broker with vacuously complete progress stays awaiting broker", () => {
  const workflow = getSignDocumentWorkflow(
    { signMode: "DYNAMIC_FORM", signStatus: "AWAITING_BROKER" },
    {
      client: { complete: true, filled: 0, total: 126, required: 0 },
      broker: { complete: true, filled: 0, total: 126, required: 0 },
      all: { complete: true, filled: 0, total: 126, required: 0 },
    },
  );
  assert.equal(workflow.brokerBucket, "awaitingYou");
  assert.equal(workflow.signStatusLabel, "Ready to send");
  assert.match(workflow.workflowHint, /send to client/i);
});

test("lender copy for awaiting broker does not claim client finished", () => {
  const {
    getViewerWorkflowCopy,
  } = require("../../utils/documents/signDocumentWorkflow");
  const workflow = getSignDocumentWorkflow(
    { signMode: "DYNAMIC_FORM", signStatus: "AWAITING_BROKER" },
    {
      client: { complete: true },
      broker: { complete: true },
      all: { complete: true },
    },
  );
  const copy = getViewerWorkflowCopy(
    workflow,
    { signStatus: "AWAITING_BROKER", signMode: "DYNAMIC_FORM" },
    "lender",
  );

  assert.equal(copy.signStatusLabel, "Awaiting broker");
  assert.match(copy.workflowHint, /preparing this form/i);
});

test("sent to client with vacuously complete progress stays with client", () => {
  const workflow = getSignDocumentWorkflow(
    { signMode: "DYNAMIC_FORM", signStatus: "SENT_TO_CLIENT" },
    {
      client: { complete: true, filled: 0, total: 126, required: 0 },
      broker: { complete: true, filled: 0, total: 126, required: 0 },
      all: { complete: true, filled: 0, total: 126, required: 0 },
    },
  );
  assert.equal(workflow.brokerBucket, "withClient");
  assert.equal(workflow.signStatusLabel, "With client");
  assert.match(workflow.workflowHint, /waiting for the client/i);
});

test("lender copy explains broker will send completed form", () => {
  const {
    getViewerWorkflowCopy,
  } = require("../../utils/documents/signDocumentWorkflow");
  const workflow = getSignDocumentWorkflow(
    { signMode: "DYNAMIC_FORM", signStatus: "CLIENT_SIGNED" },
    {
      client: { complete: true },
      broker: { complete: true },
      all: { complete: true },
    },
  );
  const copy = getViewerWorkflowCopy(
    workflow,
    { signStatus: "CLIENT_SIGNED", signMode: "DYNAMIC_FORM" },
    "lender",
  );

  assert.equal(copy.signStatusLabel, "With broker");
  assert.match(copy.workflowHint, /broker will send/i);
});

test("client copy after form submit does not mention broker forward workflow", () => {
  const {
    getViewerWorkflowCopy,
  } = require("../../utils/documents/signDocumentWorkflow");
  const workflow = getSignDocumentWorkflow(
    { signMode: "DYNAMIC_FORM", signStatus: "CLIENT_SIGNED" },
    {
      client: { complete: true },
      broker: { complete: true },
      all: { complete: true },
    },
  );
  const copy = getViewerWorkflowCopy(
    workflow,
    {
      signStatus: "CLIENT_SIGNED",
      signMode: "DYNAMIC_FORM",
      requestApplicationLender: { lender: { name: "LendingCart Lender" } },
    },
    "client",
  );

  assert.equal(copy.signStatusLabel, "Submitted");
  assert.match(copy.workflowHint, /you completed this form/i);
  assert.doesNotMatch(copy.workflowHint, /ready to forward/i);
});

test("lender copy for sent to client does not claim client finished", () => {
  const {
    getViewerWorkflowCopy,
  } = require("../../utils/documents/signDocumentWorkflow");
  const workflow = getSignDocumentWorkflow(
    { signMode: "DYNAMIC_FORM", signStatus: "SENT_TO_CLIENT" },
    {
      client: { complete: true },
      broker: { complete: true },
      all: { complete: true },
    },
  );
  const copy = getViewerWorkflowCopy(
    workflow,
    { signStatus: "SENT_TO_CLIENT", signMode: "DYNAMIC_FORM" },
    "lender",
  );

  assert.equal(copy.signStatusLabel, "With client");
  assert.match(copy.workflowHint, /completing the form/i);
});
