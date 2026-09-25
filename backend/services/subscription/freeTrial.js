/**
 * Marketing soft trials.
 *
 * - LOAN_AI_FREE_TRIAL: Loan-AI site no-card trial → expireWithoutBilling (EXPIRED / lock)
 * - CLM_GHL_SOFT_TRIAL: CLM GHL order form ($9997 course + card) + 90-day Loan Automation
 *   → after trialEndsAt convert to ACTIVE (GHL bills $699/mo from saved card).
 *   Account stays unlocked until the broker clicks Discontinue.
 */

const LOAN_AI_FREE_TRIAL_NOTE = "source:LOAN_AI_FREE_TRIAL";
const CLM_GHL_SOFT_TRIAL_NOTE = "source:CLM_GHL_SOFT_TRIAL";
/** Appended when CLM trial converts to GHL-billed ACTIVE (no LendingCart invoice). */
const CLM_GHL_BILLING_PHASE_NOTE = "clmBillingPhase:ghl_active";
/** Appended when broker voluntarily discontinues CLM software. */
const CLM_GHL_DISCONTINUED_NOTE = "clmDiscontinued:true";

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

/**
 * Trials that expire to EXPIRED with no auto-invoice (pay later on LendingCart).
 * CLM is intentionally excluded — GHL bills the saved card after 90 days.
 */
function isSoftTrialWithoutBilling(subOrNotes) {
  return isLoanAiFreeTrial(subOrNotes);
}

function isClmGhlBillingActive(subOrNotes) {
  return notesOf(subOrNotes).includes(CLM_GHL_BILLING_PHASE_NOTE);
}

function isClmDiscontinued(subOrNotes) {
  return notesOf(subOrNotes).includes(CLM_GHL_DISCONTINUED_NOTE);
}

/**
 * After trialEndsAt, CLM brokers stay ACTIVE (GHL bills) and may voluntarily discontinue.
 */
function canShowClmDiscontinue(subscription, now = new Date()) {
  if (!subscription || !isClmGhlSoftTrial(subscription)) return false;
  if (!["TRIAL", "ACTIVE"].includes(subscription.status)) return false;
  if (isClmDiscontinued(subscription)) return false;
  if (!subscription.trialEndsAt) return false;
  const ends = new Date(subscription.trialEndsAt);
  if (Number.isNaN(ends.getTime())) return false;
  return ends.getTime() <= now.getTime();
}

function appendSubscriptionNote(existingNotes, fragment) {
  const base = String(existingNotes || "").trim();
  const piece = String(fragment || "").trim();
  if (!piece) return base || null;
  if (base.includes(piece)) return base;
  return base ? `${base}; ${piece}` : piece;
}

module.exports = {
  LOAN_AI_FREE_TRIAL_NOTE,
  CLM_GHL_SOFT_TRIAL_NOTE,
  CLM_GHL_BILLING_PHASE_NOTE,
  CLM_GHL_DISCONTINUED_NOTE,
  getFreeTrialDays,
  getClmSoftTrialDays,
  getClmSoftTrialPackageCode,
  isLoanAiFreeTrial,
  isClmGhlSoftTrial,
  isSoftTrialWithoutBilling,
  isClmGhlBillingActive,
  isClmDiscontinued,
  canShowClmDiscontinue,
  appendSubscriptionNote,
};
