/**
 * Marketing soft trials.
 *
 * - LOAN_AI_FREE_TRIAL: legacy no-card Loan AI trial → expireWithoutBilling (EXPIRED / lock)
 * - LOAN_AI_CARD_TRIAL: Loan AI Stripe trial (card required) → after trialEndsAt Stripe bills;
 *   convert to ACTIVE (no LendingCart invoice). Broker may Discontinue anytime.
 * - CLM_GHL_SOFT_TRIAL: CLM GHL order form ($9997 course + card) + 90-day Loan Automation
 *   → after trialEndsAt convert to ACTIVE (GHL/Stripe bills $699/mo from saved card).
 *   Account stays unlocked until the broker clicks Discontinue.
 */

const LOAN_AI_FREE_TRIAL_NOTE = "source:LOAN_AI_FREE_TRIAL";
const LOAN_AI_CARD_TRIAL_NOTE = "source:LOAN_AI_CARD_TRIAL";
/** Appended when Loan AI card trial converts to Stripe-billed ACTIVE. */
const LOAN_AI_CARD_BILLING_PHASE_NOTE = "loanAiBillingPhase:stripe_active";
const CLM_GHL_SOFT_TRIAL_NOTE = "source:CLM_GHL_SOFT_TRIAL";
/** Appended when CLM trial converts to GHL-billed ACTIVE (no LendingCart invoice). */
const CLM_GHL_BILLING_PHASE_NOTE = "clmBillingPhase:ghl_active";
/** Appended when broker voluntarily discontinues CLM / Loan AI card-trial software. */
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

function isLoanAiCardTrial(subOrNotes) {
  return notesOf(subOrNotes).includes(LOAN_AI_CARD_TRIAL_NOTE);
}

/** Any Loan AI marketing trial (legacy no-card or card-required). */
function isLoanAiMarketingTrial(subOrNotes) {
  return isLoanAiFreeTrial(subOrNotes) || isLoanAiCardTrial(subOrNotes);
}

function isClmGhlSoftTrial(subOrNotes) {
  return notesOf(subOrNotes).includes(CLM_GHL_SOFT_TRIAL_NOTE);
}

/**
 * Trials that expire to EXPIRED with no auto-invoice (pay later on LendingCart).
 * Card trials and CLM are excluded — Stripe/GHL bills the saved card after trial.
 */
function isSoftTrialWithoutBilling(subOrNotes) {
  return isLoanAiFreeTrial(subOrNotes) && !isLoanAiCardTrial(subOrNotes);
}

function isClmGhlBillingActive(subOrNotes) {
  return notesOf(subOrNotes).includes(CLM_GHL_BILLING_PHASE_NOTE);
}

function isLoanAiCardBillingActive(subOrNotes) {
  return notesOf(subOrNotes).includes(LOAN_AI_CARD_BILLING_PHASE_NOTE);
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

/**
 * Loan AI card trial — Discontinue anytime while TRIAL/ACTIVE (cancels Stripe billing).
 */
function canShowLoanAiCardTrialDiscontinue(subscription) {
  if (!subscription || !isLoanAiCardTrial(subscription)) return false;
  if (!["TRIAL", "ACTIVE"].includes(subscription.status)) return false;
  if (isClmDiscontinued(subscription)) return false;
  return true;
}

function canShowSoftTrialDiscontinue(subscription, now = new Date()) {
  return (
    canShowClmDiscontinue(subscription, now) ||
    canShowLoanAiCardTrialDiscontinue(subscription)
  );
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
  LOAN_AI_CARD_TRIAL_NOTE,
  LOAN_AI_CARD_BILLING_PHASE_NOTE,
  CLM_GHL_SOFT_TRIAL_NOTE,
  CLM_GHL_BILLING_PHASE_NOTE,
  CLM_GHL_DISCONTINUED_NOTE,
  getFreeTrialDays,
  getClmSoftTrialDays,
  getClmSoftTrialPackageCode,
  isLoanAiFreeTrial,
  isLoanAiCardTrial,
  isLoanAiMarketingTrial,
  isClmGhlSoftTrial,
  isSoftTrialWithoutBilling,
  isClmGhlBillingActive,
  isLoanAiCardBillingActive,
  isClmDiscontinued,
  canShowClmDiscontinue,
  canShowLoanAiCardTrialDiscontinue,
  canShowSoftTrialDiscontinue,
  appendSubscriptionNote,
};
