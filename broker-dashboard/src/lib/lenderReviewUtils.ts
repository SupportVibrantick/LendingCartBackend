export type LenderReviewSummary = {
  reviewId?: string;
  reviewStatus?: string | null;
  approvedAmount?: number | string | null;
  interestRate?: number | string | null;
  notes?: string | null;
  reviewedAt?: string | null;
  updatedAt?: string | null;
};

export type LenderDecisionSource = {
  lenderStatus?: string | null;
  latestReview?: LenderReviewSummary | null;
  reviews?: LenderReviewSummary[] | null;
};

function getReviewTimestamp(review?: LenderReviewSummary | null) {
  const value = review?.reviewedAt || review?.updatedAt;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function resolveLatestLenderReview(
  lender?: LenderDecisionSource | null,
): LenderReviewSummary | null {
  if (!lender) return null;

  if (lender.latestReview) {
    return lender.latestReview;
  }

  const reviews = [...(lender.reviews || [])].sort(
    (left, right) => getReviewTimestamp(right) - getReviewTimestamp(left),
  );

  if (!reviews.length) return null;

  const lenderStatus = (lender.lenderStatus || "").toUpperCase().trim();

  if (["APPROVED", "DECLINED"].includes(lenderStatus)) {
    const matchingReview = reviews.find(
      (review) => (review.reviewStatus || "").toUpperCase() === lenderStatus,
    );
    if (matchingReview) return matchingReview;
  }

  return reviews[0];
}

export function resolveLenderDecisionStatus(
  lender?: LenderDecisionSource | null,
  review?: LenderReviewSummary | null,
) {
  const lenderStatus = (lender?.lenderStatus || "").toUpperCase().trim();
  const reviewStatus = (review?.reviewStatus || "").toUpperCase().trim();

  if (lenderStatus === "APPROVED") return "APPROVED";
  if (lenderStatus === "DECLINED") return "DECLINED";
  if (reviewStatus) return reviewStatus;

  return lenderStatus || "PENDING";
}
