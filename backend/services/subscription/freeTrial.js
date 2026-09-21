/**
 * Loan-AI marketing free trial (no card / no GHL invoice).
 * Distinct from admin Assign Plan trials, which bill on expiry.
 */

const LOAN_AI_FREE_TRIAL_NOTE = "source:LOAN_AI_FREE_TRIAL";

function getFreeTrialDays() {
  const n = Number(process.env.FREE_TRIAL_DAYS || 14);
  if (!Number.isFinite(n) || n <= 0) return 14;
  return Math.min(Math.floor(n), 90);
}

function isLoanAiFreeTrial(subOrNotes) {
  const notes =
    typeof subOrNotes === "string"
      ? subOrNotes
      : String(subOrNotes?.notes || "");
  return notes.includes(LOAN_AI_FREE_TRIAL_NOTE);
}

module.exports = {
  LOAN_AI_FREE_TRIAL_NOTE,
  getFreeTrialDays,
  isLoanAiFreeTrial,
};
