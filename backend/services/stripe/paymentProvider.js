/**
 * Resolve which payment provider handles Loan AI paid checkout.
 *
 * PAYMENT_PROVIDER=stripe|ghl
 * When unset: prefer Stripe if configured + plan prices exist, else GHL.
 */

const { canProcessGhlPayments } = require("../ghl/ghl.payment.service");
const { canProcessStripePayments } = require("./stripeCheckout.service");

function getConfiguredPaymentProvider() {
  const raw = String(process.env.PAYMENT_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (raw === "stripe" || raw === "ghl") return raw;
  return null;
}

function getPaymentProvider() {
  const forced = getConfiguredPaymentProvider();
  if (forced === "stripe") {
    return canProcessStripePayments() ? "stripe" : null;
  }
  if (forced === "ghl") {
    return canProcessGhlPayments() ? "ghl" : null;
  }
  if (canProcessStripePayments()) return "stripe";
  if (canProcessGhlPayments()) return "ghl";
  return null;
}

function canProcessLoanAiPayments() {
  return Boolean(getPaymentProvider());
}

module.exports = {
  getConfiguredPaymentProvider,
  getPaymentProvider,
  canProcessLoanAiPayments,
};
