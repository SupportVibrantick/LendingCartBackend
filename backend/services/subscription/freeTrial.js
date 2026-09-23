/**
 * Marketing soft trials (no LendingCart invoice on expiry).
 * Distinct from admin Assign Plan trials, which bill when trial ends.
 *
 * - LOAN_AI_FREE_TRIAL: Loan-AI site no-card trial
 * - CLM_GHL_SOFT_TRIAL: CLM GHL order form ($9997 course) + 90-day Loan Automation
 */

const LOAN_AI_FREE_TRIAL_NOTE = "source:LOAN_AI_FREE_TRIAL";
const CLM_GHL_SOFT_TRIAL_NOTE = "source:CLM_GHL_SOFT_TRIAL";

function getFreeTrialDays() {
  const n = Number(process.env.FREE_TRIAL_DAYS || 14);
  if (!Number.isFinite(n) || n <= 0) return 14;
  return Math.min(Math.floor(n), 90);
}

/** CLM funnel soft trial length (default 90 days / 3 months). */
function getClmSoftTrialDays() {
  const n = Number(process.env.CLM_SOFT_TRIAL_DAYS || 90);
  if (!Number.isFinite(n) || n <= 0) return 90;
  return Math.min(Math.floor(n), 365);
}

/** Package used for full Loan Automation access during CLM soft trial. */
function getClmSoftTrialPackageCode() {
  const code = String(process.env.CLM_SOFT_TRIAL_PACKAGE_CODE || "ELITE")
    .trim()
    .toUpperCase();
  return code || "ELITE";
}

function notesOf(subOrNotes) {
  return typeof subOrNotes === "string"
    ? subOrNotes
    : String(subOrNotes?.notes || "");
}

function isLoanAiFreeTrial(subOrNotes) {
  return notesOf(subOrNotes).includes(LOAN_AI_FREE_TRIAL_NOTE);
}

function isClmGhlSoftTrial(subOrNotes) {
  return notesOf(subOrNotes).includes(CLM_GHL_SOFT_TRIAL_NOTE);
}

/** Trials that expire to EXPIRED with no auto-invoice (pay later on LendingCart). */
function isSoftTrialWithoutBilling(subOrNotes) {
  return isLoanAiFreeTrial(subOrNotes) || isClmGhlSoftTrial(subOrNotes);
}

module.exports = {
  LOAN_AI_FREE_TRIAL_NOTE,
  CLM_GHL_SOFT_TRIAL_NOTE,
  getFreeTrialDays,
  getClmSoftTrialDays,
  getClmSoftTrialPackageCode,
  isLoanAiFreeTrial,
  isClmGhlSoftTrial,
  isSoftTrialWithoutBilling,
};
