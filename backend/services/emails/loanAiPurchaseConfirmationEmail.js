const { loadTemplateAsync } = require("../../utils/email/loadTemplate");
const {
  buildBrokerSignInUrl,
  getEmailBranding,
} = require("../../utils/email/emailBranding");
const { enqueueEmail } = require("../email");

function formatMoney(amount, currency = "USD") {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "USD").toUpperCase(),
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function billingCycleLabel(billingCycle) {
  const cycle = String(billingCycle || "").toUpperCase();
  if (cycle === "YEARLY" || cycle === "ANNUAL") return "Yearly";
  if (cycle === "MONTHLY") return "Monthly";
  return cycle || "Monthly";
}

function formatAddOnsLabel(addOnCodes) {
  if (!Array.isArray(addOnCodes) || addOnCodes.length === 0) return null;
  return addOnCodes
    .map((code) =>
      String(code || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .filter(Boolean)
    .join(", ");
}

/**
 * Send purchase confirmation after a paid Loan AI checkout (plan or add-ons).
 * Idempotent per checkout via idempotencyKey.
 */
async function sendLoanAiPurchaseConfirmationEmail({
  prisma,
  email,
  firstName,
  organizationName,
  packageName,
  billingCycle,
  amount,
  currency = "USD",
  addOnCodes = [],
  isAddOnUpgrade = false,
  checkoutId,
  idempotencyKey,
}) {
  const to = String(email || "")
    .trim()
    .toLowerCase();
  if (!to) {
    throw new Error("Purchase confirmation requires a recipient email");
  }

  const name = String(firstName || "").trim() || "there";
  const planLabel = packageName || "Selected Plan";
  const orgName = organizationName || "your brokerage";
  const amountLabel = formatMoney(amount, currency);
  const addOnsLabel = formatAddOnsLabel(addOnCodes);
  const cycleLabel = billingCycleLabel(billingCycle);
  const loginUrl = buildBrokerSignInUrl();
  const { brandName } = getEmailBranding();
  const title = isAddOnUpgrade
    ? "Your add-ons are unlocked"
    : "Your purchase is confirmed";

  const { html, logoAttachment } = await loadTemplateAsync(
    "loanAi/purchaseConfirmation",
    {
      name,
      email: to,
      organizationName: orgName,
      packageName: planLabel,
      billingCycleLabel: cycleLabel,
      amountLabel,
      addOnsLabel,
      isAddOnUpgrade: Boolean(isAddOnUpgrade),
      loginUrl,
      brandName: brandName || "Loan Automation",
      title,
      currentYear: new Date().getFullYear(),
    },
  );

  const subject = isAddOnUpgrade
    ? `Add-ons unlocked — ${planLabel} | Loan Automation`
    : `Purchase confirmed — ${planLabel} | Loan Automation`;

  const text = `Hi ${name},

Thanks for your purchase. Your ${planLabel} plan ${
    isAddOnUpgrade ? "add-ons have" : "subscription has"
  } been activated for ${orgName}.

Plan: ${planLabel}
Billing: ${cycleLabel}${amountLabel ? `\nAmount paid: ${amountLabel}` : ""}${
    addOnsLabel ? `\nAdd-ons: ${addOnsLabel}` : ""
  }
Account email: ${to}

Open your broker dashboard: ${loginUrl}

— Loan Automation`;

  return enqueueEmail({
    prisma,
    to,
    subject,
    text,
    html,
    logoAttachment,
    idempotencyKey:
      idempotencyKey ||
      (checkoutId
        ? `loan-ai-purchase:${checkoutId}`
        : `loan-ai-purchase:${to}:${planLabel}:${Date.now()}`),
    provider: "SMTP",
  });
}

module.exports = {
  sendLoanAiPurchaseConfirmationEmail,
  formatMoney,
  billingCycleLabel,
};
