/** Human-friendly display helpers for subscription notes / soft trials. */

export type ParsedSubscriptionNotes = {
  summary: string | null;
  /** Plain admin text when notes are not machine-encoded */
  plainNotes: string | null;
  details: Array<{ label: string; value: string }>;
  isClmSoftTrial: boolean;
  isLoanAiTrial: boolean;
  raw: string;
};

const DETAIL_LABELS: Record<string, string> = {
  ghlContactId: "GHL Contact ID",
  ghlInvoiceId: "GHL Invoice ID",
  ghlOrderTxn: "GHL Order / Transaction",
  ghlProductId: "GHL Product ID",
  ghlPriceId: "GHL Price ID",
};

export function parseSubscriptionNotes(
  notes?: string | null,
): ParsedSubscriptionNotes {
  const raw = String(notes || "").trim();
  if (!raw) {
    return {
      summary: null,
      plainNotes: null,
      details: [],
      isClmSoftTrial: false,
      isLoanAiTrial: false,
      raw: "",
    };
  }

  const isClmSoftTrial = raw.includes("source:CLM_GHL_SOFT_TRIAL");
  const isLoanAiTrial = raw.includes("source:LOAN_AI_FREE_TRIAL");
  const looksEncoded =
    isClmSoftTrial ||
    isLoanAiTrial ||
    /(?:^|;\s*)(?:source|ghl\w+)\s*=/i.test(raw);

  const details: Array<{ label: string; value: string }> = [];
  if (looksEncoded) {
    for (const part of raw.split(";")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!key || key === "source" || !value) continue;
      details.push({
        label: DETAIL_LABELS[key] || key,
        value,
      });
    }
  }

  let summary: string | null = null;
  let plainNotes: string | null = null;
  if (isClmSoftTrial) {
    summary =
      "Commercial Lending Mastery (GHL) purchase — Loan Automation soft trial. No LendingCart billing until the trial ends; then the broker must choose a paid plan.";
  } else if (isLoanAiTrial) {
    summary =
      "Loan AI free trial (no card). Access ends when the trial expires unless they subscribe.";
  } else if (!looksEncoded) {
    plainNotes = raw;
  } else {
    summary = "Subscription notes";
  }

  return {
    summary,
    plainNotes,
    details,
    isClmSoftTrial,
    isLoanAiTrial,
    raw,
  };
}

export type TrialAccessInfo = {
  label: string;
  days: number;
  shortBadge: string;
};

/** Derive a friendly trial length from dates (e.g. ~90 days → 3 months). */
export function getTrialAccessInfo(input: {
  trialEndsAt?: string | Date | null;
  periodStart?: string | Date | null;
  notes?: string | null;
}): TrialAccessInfo | null {
  if (!input.trialEndsAt) return null;
  const end = new Date(input.trialEndsAt);
  if (Number.isNaN(end.getTime())) return null;

  const start = input.periodStart ? new Date(input.periodStart) : new Date();
  const startMs = Number.isNaN(start.getTime()) ? Date.now() : start.getTime();
  const days = Math.max(1, Math.round((end.getTime() - startMs) / 86_400_000));

  const parsed = parseSubscriptionNotes(input.notes);
  if (parsed.isClmSoftTrial || (days >= 80 && days <= 100)) {
    return {
      label: "3 months free access",
      days,
      shortBadge: "3 months free",
    };
  }
  if (parsed.isLoanAiTrial || (days >= 12 && days <= 16)) {
    return {
      label: `${days}-day free trial`,
      days,
      shortBadge: `${days}-day trial`,
    };
  }
  if (days >= 28 && days <= 32) {
    return {
      label: "1 month free trial",
      days,
      shortBadge: "1 month free",
    };
  }
  return {
    label: `${days}-day free trial`,
    days,
    shortBadge: `${days}-day trial`,
  };
}

export function formatBillingCycleLabel(
  billingCycle?: string | null,
  trial?: TrialAccessInfo | null,
) {
  const cycle =
    String(billingCycle || "").toUpperCase() === "YEARLY" ? "Yearly" : "Monthly";
  if (trial) return `${cycle} plan · ${trial.label}`;
  return `${cycle} billing`;
}
