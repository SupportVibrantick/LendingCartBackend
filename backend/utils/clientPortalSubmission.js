const SIGNABLE_SUBMISSION_STATUSES = new Set(["CLIENT_PENDING", "UPDATED"]);

function submissionHasClientSignature(submission) {
  const fields = submission?.fields || [];
  return fields.some(
    (field) =>
      field.fieldKey === "borrowerSignature" &&
      field.value !== null &&
      field.value !== undefined &&
      String(field.value).trim() !== "",
  );
}

function resolveLatestActiveSubmission(submissions = []) {
  return [...submissions]
    .filter((submission) => submission.status !== "SUPERSEDED")
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0];
}

function resolveClientSignableSubmission(submissions = []) {
  const latestActive = resolveLatestActiveSubmission(submissions);

  if (!latestActive) {
    return {
      submission: null,
      reason: "No active submission found for this application.",
    };
  }

  if (latestActive.status === "COMPLETED") {
    if (submissionHasClientSignature(latestActive)) {
      return {
        submission: null,
        reason: "Application already submitted.",
        alreadySigned: true,
      };
    }

    return {
      submission: latestActive,
      reason: null,
    };
  }

  if (!SIGNABLE_SUBMISSION_STATUSES.has(latestActive.status)) {
    return {
      submission: null,
      reason: `This application cannot be signed right now (status: ${latestActive.status}).`,
    };
  }

  if (submissionHasClientSignature(latestActive)) {
    return {
      submission: null,
      reason: "Application already submitted.",
      alreadySigned: true,
    };
  }

  return {
    submission: latestActive,
    reason: null,
  };
}

function canClientSignApplication(application) {
  const submissions = application?.submissions || [];
  const result = resolveClientSignableSubmission(submissions);

  if (result.submission) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: result.reason || "Signing is not available for this application.",
    alreadySigned: Boolean(result.alreadySigned),
  };
}

module.exports = {
  SIGNABLE_SUBMISSION_STATUSES,
  submissionHasClientSignature,
  resolveLatestActiveSubmission,
  resolveClientSignableSubmission,
  canClientSignApplication,
};
