const Handlebars = require("handlebars");
const { loadTemplate } = require("../../utils/email/loadTemplate");
const { getEmailBranding } = require("../../utils/email/emailBranding");
const { enqueueEmail } = require("../email");

function money(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function roleLabel(role) {
  if (role === "LOAN_OFFICER") return "Loan officer";
  if (role === "CO_BROKER") return "Co-broker";
  if (role === "BROKER") return "Principal broker";
  return role || "Recipient";
}

function displayName(user) {
  if (!user) return "there";
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || user.email || "there";
}

function commissionsPortalUrl() {
  const { brokerDashboardUrl } = getEmailBranding();
  return `${brokerDashboardUrl}/payments/commissions`;
}

async function safeEnqueue(payload) {
  try {
    return await enqueueEmail(payload);
  } catch (error) {
    console.error("[commissionEmails]", error.message || error);
    return null;
  }
}

function renderCommissionEmail({
  template,
  title,
  name,
  introHtml,
  rows = [],
  ctaLabel,
  ctaUrl,
  footerNote,
}) {
  return loadTemplate(template, {
    title,
    name,
    intro: new Handlebars.SafeString(introHtml),
    rows,
    ctaLabel: ctaLabel || "Open commissions",
    ctaUrl: ctaUrl || commissionsPortalUrl(),
    footerNote:
      footerNote ||
      "This is an automated message from Loan Automation about your commission activity.",
    currentYear: new Date().getFullYear(),
  });
}

async function sendCommissionCalculatedEmails({
  prisma,
  organizationName,
  applicationNumber,
  commissionPool,
  commissions = [],
}) {
  const orgName = organizationName || "your broker organization";
  const deal = applicationNumber || "funded deal";
  const portalUrl = commissionsPortalUrl();

  const jobs = [];

  for (const row of commissions) {
    const user = row.recipientUser;
    const email = user?.email;
    if (!email) continue;

    const amount = money(row.commissionAmount);
    const role = roleLabel(row.recipientRole);
    const name = displayName(user);
    const isBroker = row.recipientRole === "BROKER";

    const intro = isBroker
      ? `Commissions were calculated for <strong>${deal}</strong> at <strong>${orgName}</strong>. Your firm-retained share is <strong>${amount}</strong> of a <strong>${money(commissionPool)}</strong> pool.`
      : `Commissions were calculated for <strong>${deal}</strong> at <strong>${orgName}</strong>. Your <strong>${role}</strong> share is <strong>${amount}</strong>.`;

    const html = renderCommissionEmail({
      template: "broker/commissionCalculated",
      title: isBroker ? "Commission pool calculated" : "Your commission was calculated",
      name,
      introHtml: intro,
      rows: [
        { label: "Deal", value: deal },
        { label: "Role", value: role },
        { label: "Commission", value: amount },
        { label: "Pool", value: money(commissionPool) },
      ],
      ctaUrl: portalUrl,
      footerNote: isBroker
        ? "Firm-retained amounts stay with the brokerage. Use Payments → Commissions to pay loan officers and co-brokers from your linked bank account."
        : "Your broker will send payment from the firm bank account once the payout is approved.",
    });

    jobs.push(
      safeEnqueue({
        prisma,
        to: email,
        subject: isBroker
          ? `Commissions calculated for ${deal}`
          : `Your commission for ${deal}: ${amount}`,
        text: `Hi ${name},\n\n${isBroker ? "Commissions were calculated." : "Your commission was calculated."}\nDeal: ${deal}\nAmount: ${amount}\n\nOpen: ${portalUrl}\n`,
        html,
        idempotencyKey: `commission-calculated:${row.id}`,
        provider: "SMTP",
      }),
    );
  }

  await Promise.all(jobs);
}

async function sendCommissionInvoiceEmail({
  prisma,
  recipientUser,
  organizationName,
  applicationNumber,
  invoiceNumber,
  amount,
  paymentInstructions,
}) {
  const email = recipientUser?.email;
  if (!email) return null;

  const name = displayName(recipientUser);
  const orgName = organizationName || "your broker organization";
  const deal = applicationNumber || "your deal";
  const amountLabel = money(amount);
  const portalUrl = commissionsPortalUrl();

  const html = renderCommissionEmail({
    template: "broker/commissionInvoice",
    title: "Commission invoice ready",
    name,
    introHtml: `<strong>${orgName}</strong> generated commission invoice <strong>${invoiceNumber}</strong> for <strong>${deal}</strong> totaling <strong>${amountLabel}</strong>.`,
    rows: [
      { label: "Invoice", value: invoiceNumber },
      { label: "Deal", value: deal },
      { label: "Amount", value: amountLabel },
      ...(paymentInstructions
        ? [{ label: "Payment instructions", value: String(paymentInstructions).slice(0, 400) }]
        : []),
    ],
    ctaLabel: "View commissions",
    ctaUrl: portalUrl,
  });

  return safeEnqueue({
    prisma,
    to: email,
    subject: `Commission invoice ${invoiceNumber} — ${amountLabel}`,
    text: `Hi ${name},\n\nInvoice ${invoiceNumber} for ${deal} is ready (${amountLabel}).\n\nOpen: ${portalUrl}\n`,
    html,
    idempotencyKey: `commission-invoice:${invoiceNumber}`,
    provider: "SMTP",
  });
}

async function sendCommissionPayoutSubmittedEmail({
  prisma,
  recipientUser,
  organizationName,
  applicationNumber,
  amount,
  bankLast4,
  fundingBankLast4,
}) {
  const email = recipientUser?.email;
  if (!email) return null;

  const name = displayName(recipientUser);
  const orgName = organizationName || "your broker organization";
  const deal = applicationNumber || "your deal";
  const amountLabel = money(amount);
  const portalUrl = commissionsPortalUrl();

  const intro = `An ACH bank transfer of <strong>${amountLabel}</strong> for <strong>${deal}</strong> was started by <strong>${orgName}</strong>. Funds move from the firm bank account to your bank on file${bankLast4 ? ` (····${bankLast4})` : ""}.`;

  const html = renderCommissionEmail({
    template: "broker/commissionPayoutSubmitted",
    title: "Commission payout in progress",
    name,
    introHtml: intro,
    rows: [
      { label: "Deal", value: deal },
      { label: "Amount", value: amountLabel },
      { label: "Method", value: "ACH bank transfer" },
      ...(fundingBankLast4
        ? [{ label: "From firm account", value: `····${fundingBankLast4}` }]
        : []),
      ...(bankLast4
        ? [{ label: "To your account", value: `····${bankLast4}` }]
        : []),
    ],
    ctaUrl: portalUrl,
    footerNote:
      "US ACH transfers usually settle in 1–3 business days. You will get another email when the bank confirms payment.",
  });

  return safeEnqueue({
    prisma,
    to: email,
    subject: `Commission payout started — ${amountLabel}`,
    text: `Hi ${name},\n\nAn ACH payout of ${amountLabel} for ${deal} is in progress.\n\nOpen: ${portalUrl}\n`,
    html,
    idempotencyKey: `commission-payout-submitted:${recipientUser.id}:${applicationNumber}:${amountLabel}`,
    provider: "SMTP",
  });
}

async function sendCommissionPayoutSettledEmail({
  prisma,
  recipientUser,
  organizationName,
  applicationNumber,
  amount,
  paymentReference,
}) {
  const email = recipientUser?.email;
  if (!email) return null;

  const name = displayName(recipientUser);
  const orgName = organizationName || "your broker organization";
  const deal = applicationNumber || "your deal";
  const amountLabel = money(amount);
  const portalUrl = commissionsPortalUrl();

  const html = renderCommissionEmail({
    template: "broker/commissionPayoutSettled",
    title: "Commission paid",
    name,
    introHtml: `<strong>${orgName}</strong> completed an ACH payout of <strong>${amountLabel}</strong> for <strong>${deal}</strong>. The funds should appear in your bank account.`,
    rows: [
      { label: "Deal", value: deal },
      { label: "Amount", value: amountLabel },
      ...(paymentReference
        ? [{ label: "Reference", value: paymentReference }]
        : []),
    ],
    ctaUrl: portalUrl,
  });

  return safeEnqueue({
    prisma,
    to: email,
    subject: `Commission paid — ${amountLabel}`,
    text: `Hi ${name},\n\nYour commission of ${amountLabel} for ${deal} was paid via ACH.\n\nOpen: ${portalUrl}\n`,
    html,
    idempotencyKey: `commission-payout-settled:${recipientUser.id}:${applicationNumber}:${amountLabel}:${paymentReference || "none"}`,
    provider: "SMTP",
  });
}

async function sendCommissionPayoutFailedEmail({
  prisma,
  recipientUser,
  brokerAdminEmail,
  organizationName,
  applicationNumber,
  amount,
  reason,
}) {
  const portalUrl = commissionsPortalUrl();
  const orgName = organizationName || "your broker organization";
  const deal = applicationNumber || "your deal";
  const amountLabel = money(amount);
  const jobs = [];

  if (recipientUser?.email) {
    const name = displayName(recipientUser);
    const html = renderCommissionEmail({
      template: "broker/commissionPayoutFailed",
      title: "Commission payout issue",
      name,
      introHtml: `The ACH payout of <strong>${amountLabel}</strong> for <strong>${deal}</strong> from <strong>${orgName}</strong> could not be completed.`,
      rows: [
        { label: "Deal", value: deal },
        { label: "Amount", value: amountLabel },
        ...(reason ? [{ label: "Reason", value: String(reason).slice(0, 300) }] : []),
      ],
      ctaUrl: portalUrl,
      footerNote: "Your broker has been notified and can retry once banking details are corrected.",
    });

    jobs.push(
      safeEnqueue({
        prisma,
        to: recipientUser.email,
        subject: `Commission payout issue — ${amountLabel}`,
        text: `Hi ${name},\n\nThe ACH payout of ${amountLabel} for ${deal} failed.\n${reason || ""}\n\nOpen: ${portalUrl}\n`,
        html,
        idempotencyKey: `commission-payout-failed-recipient:${recipientUser.id}:${deal}:${amountLabel}`,
        provider: "SMTP",
      }),
    );
  }

  if (brokerAdminEmail) {
    const html = renderCommissionEmail({
      template: "broker/commissionPayoutFailed",
      title: "Commission ACH failed",
      name: "Broker admin",
      introHtml: `An ACH commission payout of <strong>${amountLabel}</strong> for <strong>${deal}</strong> failed. Check firm and recipient bank details, then retry from Payments → Commissions.`,
      rows: [
        { label: "Deal", value: deal },
        { label: "Amount", value: amountLabel },
        ...(reason ? [{ label: "Reason", value: String(reason).slice(0, 300) }] : []),
      ],
      ctaLabel: "Retry in commissions",
      ctaUrl: portalUrl,
    });

    jobs.push(
      safeEnqueue({
        prisma,
        to: brokerAdminEmail,
        subject: `Commission ACH failed — ${deal}`,
        text: `ACH payout of ${amountLabel} for ${deal} failed.\n${reason || ""}\n\nOpen: ${portalUrl}\n`,
        html,
        idempotencyKey: `commission-payout-failed-admin:${brokerAdminEmail}:${deal}:${amountLabel}`,
        provider: "SMTP",
      }),
    );
  }

  await Promise.all(jobs);
}

async function sendCommissionPayoutRecordedEmail({
  prisma,
  recipientUser,
  organizationName,
  applicationNumber,
  amount,
  paymentMethod,
}) {
  const email = recipientUser?.email;
  if (!email) return null;

  const name = displayName(recipientUser);
  const orgName = organizationName || "your broker organization";
  const deal = applicationNumber || "your deal";
  const amountLabel = money(amount);
  const method = paymentMethod || "MANUAL";
  const portalUrl = commissionsPortalUrl();

  const html = renderCommissionEmail({
    template: "broker/commissionPayoutSettled",
    title: "Commission marked paid",
    name,
    introHtml: `<strong>${orgName}</strong> recorded a <strong>${method}</strong> payout of <strong>${amountLabel}</strong> for <strong>${deal}</strong>.`,
    rows: [
      { label: "Deal", value: deal },
      { label: "Amount", value: amountLabel },
      { label: "Method", value: method },
    ],
    ctaUrl: portalUrl,
  });

  return safeEnqueue({
    prisma,
    to: email,
    subject: `Commission marked paid — ${amountLabel}`,
    text: `Hi ${name},\n\nA ${method} payout of ${amountLabel} for ${deal} was recorded.\n\nOpen: ${portalUrl}\n`,
    html,
    idempotencyKey: `commission-payout-recorded:${recipientUser.id}:${deal}:${amountLabel}:${method}`,
    provider: "SMTP",
  });
}

module.exports = {
  money,
  sendCommissionCalculatedEmails,
  sendCommissionInvoiceEmail,
  sendCommissionPayoutSubmittedEmail,
  sendCommissionPayoutSettledEmail,
  sendCommissionPayoutFailedEmail,
  sendCommissionPayoutRecordedEmail,
};
