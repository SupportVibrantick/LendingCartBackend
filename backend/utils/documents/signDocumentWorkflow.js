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

function isMeaningfullyComplete(progressRole) {
  if (!progressRole || !progressRole.complete) return false;
  const total = Number(progressRole.total) || 0;
  const filled = Number(progressRole.filled) || 0;
  const required = Number(progressRole.required) || 0;
  // Vacuous complete (0 required, 0 filled, many fields) is not "done".
  if (total > 0 && required === 0 && filled === 0) return false;
  return true;
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
    clientComplete: isMeaningfullyComplete(formProgress?.client),
    brokerComplete: formProgress?.broker
      ? isMeaningfullyComplete(formProgress.broker)
      : true,
    allComplete: isMeaningfullyComplete(formProgress?.all),
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
  } else if (status === "CLIENT_SIGNED") {
    brokerBucket = WORKFLOW_BUCKETS.READY_TO_FORWARD;
    lenderBucket = WORKFLOW_BUCKETS.IN_PROGRESS;
    clientBucket = WORKFLOW_BUCKETS.COMPLETED;
    signStatusLabel = isForm ? "Form complete" : "Client signed";
    workflowHint = isForm
      ? "Form complete — ready to forward to lender"
      : "Client signed — awaiting broker forward";
  } else if (status === "SENT_TO_CLIENT") {
    // Sequential: client fills and submits first. Broker only takes over when
    // the client has meaningfully finished AND broker-required fields remain.
    if (isForm && clientComplete && !brokerComplete) {
      brokerBucket = WORKFLOW_BUCKETS.AWAITING_YOU;
      signStatusLabel = "Broker fields pending";
      workflowHint = "Client done — finish remaining broker fields";
    } else {
      brokerBucket = WORKFLOW_BUCKETS.WITH_CLIENT;
      signStatusLabel = isForm ? "With client" : "Sent to client";
      workflowHint = "Waiting for the client to fill and submit";
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

function getViewerWorkflowCopy(workflow, requirement, viewer = "broker") {
  const status = requirement?.signStatus || null;
  const isForm = workflow.isForm;
  const lenderName =
    requirement?.requestApplicationLender?.lender?.name ||
    requirement?.lenderName ||
    null;
  const lenderLabel = lenderName || "the lender";

  if (viewer === "client") {
    if (status === "LENDER_SEEN") {
      return {
        signStatusLabel: "Reviewed by lender",
        workflowHint: `${lenderLabel} has reviewed your submitted form`,
      };
    }

    if (status === "FORWARDED_TO_LENDER") {
      return {
        signStatusLabel: "With lender",
        workflowHint: `Your broker sent this completed form to ${lenderLabel}`,
      };
    }

    if (status === "CLIENT_SIGNED") {
      return {
        signStatusLabel: isForm ? "Submitted" : "Signed",
        workflowHint: isForm
          ? `You completed this form — your broker will review and send it to ${lenderLabel}`
          : `You signed this document — your broker will forward it to ${lenderLabel}`,
      };
    }

    if (status === "SENT_TO_CLIENT") {
      if (workflow.clientBucket === "waitingOnBroker") {
        return {
          signStatusLabel: "With broker",
          workflowHint: isForm
            ? "You finished your part — your broker is completing the remaining fields"
            : "Your broker is finishing this before sending it to the lender",
        };
      }

      return {
        signStatusLabel: "Action needed",
        workflowHint: isForm
          ? "Fill your assigned form fields, then submit"
          : "Fill out this form and submit it to your broker",
      };
    }

    return {
      signStatusLabel: workflow.signStatusLabel,
      workflowHint: workflow.workflowHint,
    };
  }

  if (viewer !== "lender") {
    return {
      signStatusLabel: workflow.signStatusLabel,
      workflowHint: workflow.workflowHint,
    };
  }

  const isFormLender = workflow.isForm;

  if (status === "LENDER_SEEN") {
    return {
      signStatusLabel: "Reviewed",
      workflowHint: "You reviewed this completed form",
    };
  }

  if (status === "FORWARDED_TO_LENDER") {
    return {
      signStatusLabel: "Ready to review",
      workflowHint: "Completed copy received — review and download",
    };
  }

  if (status === "CLIENT_SIGNED") {
    return {
      signStatusLabel: isFormLender ? "With broker" : "Client signed",
      workflowHint: isFormLender
        ? "Client finished — broker will send the completed copy to you"
        : "Client signed — waiting for broker to send to you",
    };
  }

  if (status === "SENT_TO_CLIENT") {
    if (isFormLender && workflow.clientComplete && !workflow.brokerComplete) {
      return {
        signStatusLabel: "Broker fields pending",
        workflowHint: "Client finished their fields — broker is completing the rest",
      };
    }

    return {
      signStatusLabel: "With client",
      workflowHint: "Waiting for the client to fill and submit",
    };
  }

  if (status === "AWAITING_BROKER") {
    return {
      signStatusLabel: isFormLender
        ? workflow.brokerComplete
          ? "Awaiting broker"
          : "Broker setup"
        : "Awaiting broker",
      workflowHint: isFormLender
        ? "Broker is preparing this form before sending to the client"
        : "Broker will send this to the client to fill",
    };
  }

  return {
    signStatusLabel: workflow.signStatusLabel,
    workflowHint: workflow.workflowHint,
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
  getViewerWorkflowCopy,
  countWorkflow,
};
