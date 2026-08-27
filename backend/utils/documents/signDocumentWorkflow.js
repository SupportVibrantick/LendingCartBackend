const WORKFLOW_BUCKETS = {
  AWAITING_YOU: "awaitingYou",
  WITH_CLIENT: "withClient",
  READY_TO_FORWARD: "readyToForward",
  FORWARDED: "forwarded",
  IN_PROGRESS: "inProgress",
  RECEIVED: "received",
  ACTION_REQUIRED: "actionRequired",
  WAITING_ON_BROKER: "waitingOnBroker",
  COMPLETED: "completed",
};

function isDynamicForm(requirement) {
  return requirement?.signMode === "DYNAMIC_FORM";
}

function progressFlags(formProgress, isForm) {
  if (!isForm) {
    return {
      clientComplete: false,
      brokerComplete: true,
      allComplete: false,
    };
  }

  return {
    clientComplete: Boolean(formProgress?.client?.complete),
    brokerComplete: formProgress?.broker
      ? Boolean(formProgress.broker.complete)
      : true,
    allComplete: Boolean(formProgress?.all?.complete),
  };
}

function getSignDocumentWorkflow(requirement, formProgress = requirement?.formProgress) {
  const status = requirement?.signStatus || null;
  const isForm = isDynamicForm(requirement);
  const { clientComplete, brokerComplete, allComplete } = progressFlags(
    formProgress,
    isForm,
  );

  let brokerBucket = WORKFLOW_BUCKETS.AWAITING_YOU;
  let lenderBucket = WORKFLOW_BUCKETS.IN_PROGRESS;
  let clientBucket = WORKFLOW_BUCKETS.COMPLETED;
  let signStatusLabel = "In progress";
  let workflowHint = "In progress";

  if (status === "FORWARDED_TO_LENDER" || status === "LENDER_SEEN") {
    brokerBucket = WORKFLOW_BUCKETS.FORWARDED;
    lenderBucket = WORKFLOW_BUCKETS.RECEIVED;
    clientBucket = WORKFLOW_BUCKETS.COMPLETED;
    signStatusLabel =
      status === "LENDER_SEEN" ? "Seen by lender" : "Forwarded to lender";
    workflowHint =
      status === "LENDER_SEEN"
        ? "Reviewed by lender"
        : "Forwarded to lender";
  } else if (status === "CLIENT_SIGNED" || (isForm && allComplete)) {
    brokerBucket = WORKFLOW_BUCKETS.READY_TO_FORWARD;
    lenderBucket = WORKFLOW_BUCKETS.IN_PROGRESS;
    clientBucket = WORKFLOW_BUCKETS.COMPLETED;
    signStatusLabel = isForm ? "Form complete" : "Client signed";
    workflowHint = isForm
      ? "Form complete — ready to forward to lender"
      : "Client signed — awaiting broker forward";
  } else if (status === "SENT_TO_CLIENT") {
    if (isForm && !brokerComplete) {
      brokerBucket = WORKFLOW_BUCKETS.AWAITING_YOU;
      signStatusLabel = clientComplete
        ? "Broker fields pending"
        : "Form in progress";
      workflowHint = clientComplete
        ? "Client done — finish remaining broker fields"
        : "Client and broker can both fill remaining fields";
    } else {
      brokerBucket = WORKFLOW_BUCKETS.WITH_CLIENT;
      signStatusLabel = isForm ? "With client" : "Sent to client";
      workflowHint = isForm
        ? "Waiting for the client to complete their fields"
        : "Waiting for client signature";
    }

    if (isForm && clientComplete && !allComplete) {
      clientBucket = WORKFLOW_BUCKETS.WAITING_ON_BROKER;
    } else if (isForm && !clientComplete) {
      clientBucket = WORKFLOW_BUCKETS.ACTION_REQUIRED;
    } else if (!isForm) {
      clientBucket = WORKFLOW_BUCKETS.ACTION_REQUIRED;
    } else {
      clientBucket = WORKFLOW_BUCKETS.WAITING_ON_BROKER;
    }

    lenderBucket = WORKFLOW_BUCKETS.IN_PROGRESS;
  } else if (status === "AWAITING_BROKER") {
    brokerBucket = WORKFLOW_BUCKETS.AWAITING_YOU;
    lenderBucket = WORKFLOW_BUCKETS.IN_PROGRESS;
    clientBucket = WORKFLOW_BUCKETS.COMPLETED;
    signStatusLabel = isForm
      ? brokerComplete
        ? "Ready to send"
        : "Broker setup needed"
      : "Awaiting broker";
    workflowHint = isForm
      ? "Fill broker fields if needed, then send to client"
      : "Awaiting broker to send to client";
  }

  return {
    isForm,
    clientComplete,
    brokerComplete,
    allComplete,
    brokerBucket,
    lenderBucket,
    clientBucket,
    signStatusLabel,
    workflowHint,
    emailPreset: isForm ? "formFillRequired" : "signatureRequired",
  };
}

function countWorkflow(rows, viewer = "broker") {
  const key =
    viewer === "lender"
      ? "lenderBucket"
      : viewer === "client"
        ? "clientBucket"
        : "brokerBucket";

  const counts = {
    awaitingYou: 0,
    withClient: 0,
    readyToForward: 0,
    forwarded: 0,
    inProgress: 0,
    received: 0,
    actionRequired: 0,
    waitingOnBroker: 0,
    completed: 0,
  };

  for (const row of rows || []) {
    const bucket = row[key];
    if (bucket && Object.prototype.hasOwnProperty.call(counts, bucket)) {
      counts[bucket] += 1;
    }
  }

  return counts;
}

module.exports = {
  WORKFLOW_BUCKETS,
  isDynamicForm,
  getSignDocumentWorkflow,
  countWorkflow,
};
