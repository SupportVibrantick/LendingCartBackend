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
