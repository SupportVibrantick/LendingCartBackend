type SubmissionLike = {
  status?: string | null;
  createdAt?: string | null;
  fields?: Array<{ fieldKey?: string | null; value?: unknown }>;
};

type ApplicationLike = {
  status?: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
  borrowerSignature?: string | null;
  submissions?: SubmissionLike[];
  latestSubmission?: SubmissionLike | null;
};

const SIGNABLE_SUBMISSION_STATUSES = new Set(["CLIENT_PENDING", "UPDATED"]);

export function submissionHasClientSignature(
  submission?: SubmissionLike | null,
  fallbackSignature?: string | null,
) {
  if (fallbackSignature) return true;

  return (submission?.fields || []).some(
    (field) =>
      field.fieldKey === "borrowerSignature" &&
      field.value !== null &&
      field.value !== undefined &&
      String(field.value).trim() !== "",
  );
}

export function resolveLatestActiveSubmission(
  submissions: SubmissionLike[] = [],
) {
  return [...submissions]
    .filter((submission) => submission.status !== "SUPERSEDED")
    .sort(
      (left, right) =>
        new Date(right.createdAt || 0).getTime() -
        new Date(left.createdAt || 0).getTime(),
    )[0];
}

export function resolveClientSignableSubmission(application?: ApplicationLike | null) {
  const submissions = application?.submissions || [];
  const latestSubmission =
    application?.latestSubmission ||
    resolveLatestActiveSubmission(submissions);

  if (!latestSubmission) {
    return {
      submission: null as SubmissionLike | null,
      canSign: false,
      reason: "No active submission found for this application.",
      alreadySigned: false,
    };
  }

  const hasSignature = submissionHasClientSignature(
    latestSubmission,
    application?.borrowerSignature,
  );

  if (latestSubmission.status === "COMPLETED" || hasSignature) {
    return {
      submission: latestSubmission,
      canSign: false,
      reason: "Application already submitted.",
      alreadySigned: true,
    };
  }

  if (!SIGNABLE_SUBMISSION_STATUSES.has(String(latestSubmission.status || ""))) {
    return {
      submission: latestSubmission,
      canSign: false,
      reason: `Signing is not available for status: ${latestSubmission.status || "unknown"}.`,
      alreadySigned: false,
    };
  }

  return {
    submission: latestSubmission,
    canSign: true,
    reason: "",
    alreadySigned: false,
  };
}

export function canClientSignApplication(application?: ApplicationLike | null) {
  return resolveClientSignableSubmission(application);
}

export function formatClientPortalSubmittedDate(application?: ApplicationLike | null) {
  const latestSubmission = resolveLatestActiveSubmission(
    application?.submissions || [],
  );

  const value =
    application?.submittedAt ||
    latestSubmission?.createdAt ||
    application?.createdAt;

  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
}
