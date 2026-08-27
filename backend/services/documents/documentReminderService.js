const crypto = require("crypto");
const sendMail = require("../emails/mail");
const { loadTemplate } = require("../../utils/email/loadTemplate");
const { getWorkerId } = require("../jobs/lock.service");
const {
  buildDocumentReminderEmailData,
} = require("../../utils/email/emailTemplateData");
const {
  buildClientPortalUrl,
  ensureAbsoluteUrl,
  resolveBrokerEmailBranding,
} = require("../../utils/email/emailBranding");
const { resolveClientDisplayName } = require("../../utils/applications/resolveClientDisplayName");
const { notifyClient, CLIENT_NOTIFICATION_EVENTS } = require("../notifications/clientNotifications");
const { notifyLender, LENDER_NOTIFICATION_EVENTS } = require("../notifications/lenderNotifications");

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const REMINDER_LOCK_MS = 60_000;
const REMINDER_BATCH_SIZE = 50;
const WORKER_ID = getWorkerId();

function computeReminderBackoff(attempts) {
  const delaySeconds = Math.min(3600, Math.pow(2, Math.max(attempts, 1)) * 60);
  return new Date(Date.now() + delaySeconds * 1000);
}

const REMINDER_TYPE_LABELS = {
  PENDING_UPLOAD: "Pending document uploads",
  SIGNATURE_REQUIRED: "Pending signatures",
  LENDER_REVIEW: "Documents awaiting review",
};

function computeNextRunAt(fromDate, intervalValue, intervalUnit) {
  const base = new Date(fromDate);
  const value = Math.max(1, Number(intervalValue) || 1);

  switch (intervalUnit) {
    case "MINUTES":
      return new Date(base.getTime() + value * MS_PER_MINUTE);
    case "HOURS":
      return new Date(base.getTime() + value * MS_PER_HOUR);
    case "DAYS":
    default:
      return new Date(base.getTime() + value * MS_PER_DAY);
  }
}

/**
 * Schedule the next run from the prior slot (not send completion time) so
 * minute-level cron ticks are not skipped when SMTP is slow.
 */
function computeAnchoredNextRunAt(schedule, now = new Date()) {
  const intervalValue = schedule.intervalValue;
  const intervalUnit = schedule.intervalUnit;

  let anchor = schedule.nextRunAt || schedule.lastSentAt || now;
  if (anchor > now) {
    anchor = now;
  }

  let nextRunAt = computeNextRunAt(anchor, intervalValue, intervalUnit);

  while (nextRunAt.getTime() <= now.getTime()) {
    nextRunAt = computeNextRunAt(nextRunAt, intervalValue, intervalUnit);
  }

  return nextRunAt;
}

function immediateNextRunAt() {
  return new Date();
}

function formatIntervalLabel(intervalValue, intervalUnit) {
  const value = Math.max(1, Number(intervalValue) || 1);
  const unit = String(intervalUnit || "DAYS").toLowerCase();
  const singular = unit.replace(/s$/, "");
  return `Every ${value} ${value === 1 ? singular : unit}`;
}

async function ensureClientUploadToken(prisma, loan) {
  const existing = await prisma.clientUploadToken.findUnique({
    where: { loanApplicationId: loan.id },
  });

  if (existing && new Date(existing.expiresAt) > new Date()) {
    return existing.token;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const record = await prisma.clientUploadToken.upsert({
    where: { loanApplicationId: loan.id },
    update: {
      token,
      expiresAt,
      isUsed: false,
    },
    create: {
      loanApplicationId: loan.id,
      clientId: loan.clientId,
      token,
      expiresAt,
    },
  });

  return record.token;
}

async function resolveClientEmail(loan) {
  const contacts = loan.client?.contacts || [];
  const primary = contacts.find((c) => c.isPrimary && c.email);
  const fallback = contacts.find((c) => c.email);
  return primary?.email || fallback?.email || null;
}

async function resolveLenderEmail(prisma, applicationLenderId) {
  const applicationLender = await prisma.applicationLender.findUnique({
    where: { id: applicationLenderId },
    include: {
      lender: {
        include: {
          users: {
            where: { status: "ACTIVE" },
            select: { email: true, firstName: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!applicationLender) return null;

  const userEmail = applicationLender.lender?.users?.[0]?.email;
  return userEmail || applicationLender.lender?.email || null;
}

async function fetchPendingItems(prisma, schedule) {
  const { loanApplicationId, reminderType, applicationLenderId } = schedule;

  const requirements = await prisma.applicationDocumentRequirement.findMany({
    where: { loanApplicationId },
    include: {
      documentType: { select: { name: true } },
      activeFormVersion: { select: { schemaJson: true } },
      signFormSubmissions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { values: { select: { fieldKey: true, valueJson: true } } },
      },
      uploads: {
        select: {
          id: true,
          fileName: true,
          isSubmittedToLender: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (reminderType === "PENDING_UPLOAD") {
    return requirements
      .filter(
        (doc) =>
          !doc.requiresClientSignature &&
          ["PENDING", "PARTIAL"].includes(doc.status),
      )
      .map((doc) => ({
        id: doc.id,
        name: doc.documentType?.name || doc.signDocumentTitle || "Document",
        status: doc.status,
      }));
  }

  if (reminderType === "SIGNATURE_REQUIRED") {
    return requirements
      .filter((doc) => {
        if (!doc.requiresClientSignature || !doc.signStatus) return false;
        if (
          ["CLIENT_SIGNED", "FORWARDED_TO_LENDER", "LENDER_SEEN"].includes(
            doc.signStatus,
          )
        ) {
          return false;
        }
        if (doc.signStatus !== "SENT_TO_CLIENT") return false;
        if (doc.signMode === "DYNAMIC_FORM") {
          const submission = (doc.signFormSubmissions || [])[0];
          const values = {};
          for (const item of submission?.values || []) {
            values[item.fieldKey] = item.valueJson;
          }
          try {
            const {
              computeProgress,
            } = require("../signForm/submissionService");
            const progress = computeProgress(
              doc.activeFormVersion?.schemaJson,
              values,
            );
            return !progress.client.complete;
          } catch {
            return true;
          }
        }
        return true;
      })
      .map((doc) => ({
        id: doc.id,
        name: doc.signDocumentTitle || doc.documentType?.name || "Sign document",
        status: doc.signStatus || "PENDING",
      }));
  }

  if (reminderType === "LENDER_REVIEW" && applicationLenderId) {
    const submissions = await prisma.applicationDocumentSubmission.findMany({
      where: { applicationLenderId },
      include: {
        documentUpload: {
          include: {
            documentRequirement: {
              include: { documentType: { select: { name: true } } },
            },
          },
        },
      },
    });

    const signDocs = requirements.filter(
      (doc) =>
        doc.requestApplicationLenderId === applicationLenderId &&
        doc.signStatus === "FORWARDED_TO_LENDER" &&
        !doc.lenderSeenAt,
    );

    const uploadedDocs = submissions
      .map((s) => s.documentUpload?.documentRequirement)
      .filter(Boolean)
      .map((doc) => ({
        id: doc.id,
        name: doc.signDocumentTitle || doc.documentType?.name || "Document",
        status: "SUBMITTED",
      }));

    const combined = [...signDocs, ...uploadedDocs];
    const seen = new Set();

    return combined
      .filter((doc) => {
        if (seen.has(doc.id)) return false;
        seen.add(doc.id);
        return true;
      })
      .map((doc) => ({
        id: doc.id,
        name: doc.signDocumentTitle || doc.documentType?.name || "Document",
        status: doc.signStatus || doc.status || "SUBMITTED",
      }));
  }

  return [];
}

async function sendDocumentReminderEmail(prisma, schedule, loan, pendingItems) {
  const emailBranding = await resolveBrokerEmailBranding(
    prisma,
    schedule.brokerOrgId,
  );

  const brokerName =
    loan.brokerOrg?.name ||
    schedule.createdBy?.firstName ||
    "Your broker";

  let recipientEmail = null;
  let portalLink = "";
  let preset = "documentsRequested";
  let recipientName = "there";

  if (schedule.recipientType === "CLIENT") {
    recipientEmail = await resolveClientEmail(loan);
    recipientName = await resolveClientDisplayName(prisma, {
      clientId: loan.clientId,
      client: loan.client,
      contacts: loan.client?.contacts || [],
    });
    const token = await ensureClientUploadToken(prisma, loan);
    portalLink = buildClientPortalUrl({ token });
    preset =
      schedule.reminderType === "SIGNATURE_REQUIRED"
        ? "signatureRequired"
        : "documentsRequested";
  } else if (schedule.recipientType === "LENDER" && schedule.applicationLenderId) {
    recipientEmail = await resolveLenderEmail(prisma, schedule.applicationLenderId);
    const { buildLenderLoanPreviewUrl } = require("../../utils/email/emailBranding");
    portalLink = buildLenderLoanPreviewUrl(schedule.applicationLenderId);
    preset = "lenderReview";
    const lender = await prisma.applicationLender.findUnique({
      where: { id: schedule.applicationLenderId },
      include: { lender: { select: { name: true } } },
    });
    recipientName = lender?.lender?.name || "Lender";
  }

  if (!recipientEmail) {
    throw new Error("Recipient email not available");
  }

  portalLink = ensureAbsoluteUrl(portalLink);

  const subject =
    schedule.recipientType === "CLIENT"
      ? `Reminder: ${REMINDER_TYPE_LABELS[schedule.reminderType]} — Application #${loan.applicationNumber}`
      : `Reminder: Documents for review — Application #${loan.applicationNumber}`;

  const templateData = buildDocumentReminderEmailData({
    recipientName,
    applicationNumber: loan.applicationNumber,
    brokerName,
    portalLink,
    customMessage: schedule.customMessage,
    reminderTypeLabel: REMINDER_TYPE_LABELS[schedule.reminderType],
    pendingDocuments: pendingItems,
    preset,
    intervalLabel: formatIntervalLabel(
      schedule.intervalValue,
      schedule.intervalUnit,
    ),
  });

  const html = loadTemplate("broker/documentReminder", {
    ...emailBranding,
    ...templateData,
    emailTitle: templateData.emailTitle,
  });

  const documentLines = pendingItems.map((d) => `- ${d.name} (${d.status})`).join("\n");

  const text = `Hello ${recipientName},

This is a reminder regarding Application #${loan.applicationNumber}.

${REMINDER_TYPE_LABELS[schedule.reminderType]}:
${documentLines || "No items listed"}

${schedule.customMessage || ""}

Open: ${portalLink}

— ${brokerName}`;

  await sendMail({
    prisma,
    to: recipientEmail,
    subject,
    text,
    html,
    idempotencyKey: `doc-reminder:${schedule.id}:${schedule.nextRunAt?.toISOString?.() || "immediate"}`,
  });

  return { recipientEmail, subject };
}

async function processSingleReminder(prisma, io, schedule) {
  const loan = await prisma.loanApplication.findUnique({
    where: { id: schedule.loanApplicationId },
    include: {
      client: { include: { contacts: true } },
      brokerOrg: { select: { name: true } },
    },
  });

  if (!loan) {
    await prisma.documentReminderSchedule.update({
      where: { id: schedule.id },
      data: {
        status: "STOPPED",
        lockedBy: null,
        lockedUntil: null,
      },
    });
    return { id: schedule.id, action: "stopped", reason: "loan_not_found" };
  }

  const pendingItems = await fetchPendingItems(prisma, schedule);

  if (pendingItems.length === 0) {
    await prisma.documentReminderSchedule.update({
      where: { id: schedule.id },
      data: {
        status: "COMPLETED",
        nextRunAt: null,
        lockedBy: null,
        lockedUntil: null,
        attempts: 0,
        lastError: null,
      },
    });
    return { id: schedule.id, action: "completed", reason: "no_pending_items" };
  }

  const { recipientEmail, subject } = await sendDocumentReminderEmail(
    prisma,
    schedule,
    loan,
    pendingItems,
  );

  const now = new Date();
  const nextRunAt = computeAnchoredNextRunAt(schedule, now);

  await prisma.documentReminderSchedule.update({
    where: { id: schedule.id },
    data: {
      lastSentAt: now,
      nextRunAt,
      attempts: 0,
      lastError: null,
      lockedBy: null,
      lockedUntil: null,
    },
  });

  await prisma.notification.create({
    data: {
      eventType: "DOCUMENT_REMINDER_SENT",
      category: "DOCUMENT",
      channel: "EMAIL",
      status: "SENT",
      recipientType: schedule.recipientType,
      recipientOrgId:
        schedule.recipientType === "LENDER"
          ? (
              await prisma.applicationLender.findUnique({
                where: { id: schedule.applicationLenderId },
                select: { lenderOrgId: true },
              })
            )?.lenderOrgId
          : schedule.brokerOrgId,
      recipientClientId:
        schedule.recipientType === "CLIENT" ? loan.clientId : null,
      subject,
      body: `Reminder sent for application ${loan.applicationNumber}`,
      metadata: {
        reminderId: schedule.id,
        applicationId: loan.id,
        applicationNumber: loan.applicationNumber,
        reminderType: schedule.reminderType,
        documentCount: pendingItems.length,
        recipientEmail,
      },
      sentAt: now,
    },
  });

  if (schedule.recipientType === "CLIENT" && loan.clientId) {
    await notifyClient(prisma, io, {
      clientId: loan.clientId,
      eventType: CLIENT_NOTIFICATION_EVENTS.DOCUMENTS_REQUESTED,
      category: "DOCUMENT",
      subject: `Reminder: documents needed for #${loan.applicationNumber}`,
      body: `${pendingItems.length} item(s) still pending for your application.`,
      metadata: {
        applicationId: loan.id,
        applicationNumber: loan.applicationNumber,
        reminderId: schedule.id,
        documentCount: pendingItems.length,
      },
    });
  }

  if (schedule.recipientType === "LENDER" && schedule.applicationLenderId) {
    const appLender = await prisma.applicationLender.findUnique({
      where: { id: schedule.applicationLenderId },
      select: { lenderOrgId: true },
    });

    if (appLender?.lenderOrgId) {
      await notifyLender(prisma, io, {
        lenderOrgId: appLender.lenderOrgId,
        eventType: LENDER_NOTIFICATION_EVENTS.DOCUMENT_UPLOADED,
        category: "DOCUMENT",
        subject: `Reminder: review documents for #${loan.applicationNumber}`,
        body: `${pendingItems.length} document(s) awaiting your review.`,
        metadata: {
          applicationId: loan.id,
          applicationNumber: loan.applicationNumber,
          applicationLenderId: schedule.applicationLenderId,
          reminderId: schedule.id,
        },
      });
    }
  }

  return {
    id: schedule.id,
    action: "sent",
    recipientEmail,
    documentCount: pendingItems.length,
  };
}

async function claimDueDocumentReminders(prisma) {
  const now = new Date();
  const candidates = await prisma.documentReminderSchedule.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      AND: [
        {
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
        },
      ],
    },
    take: REMINDER_BATCH_SIZE,
    orderBy: { nextRunAt: "asc" },
  });

  const claimed = [];

  for (const record of candidates) {
    if (record.attempts >= record.maxAttempts) {
      continue;
    }

    const lockUntil = new Date(Date.now() + REMINDER_LOCK_MS);
    const updated = await prisma.documentReminderSchedule.updateMany({
      where: {
        id: record.id,
        status: "ACTIVE",
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
      data: {
        lockedBy: WORKER_ID,
        lockedUntil: lockUntil,
      },
    });

    if (updated.count === 1) {
      claimed.push(
        await prisma.documentReminderSchedule.findUnique({
          where: { id: record.id },
        }),
      );
    }
  }

  return claimed.filter(Boolean);
}

async function handleReminderFailure(prisma, schedule, error) {
  const nextAttempts = (schedule.attempts || 0) + 1;
  const isDead = nextAttempts >= (schedule.maxAttempts || 10);

  await prisma.documentReminderSchedule.update({
    where: { id: schedule.id },
    data: {
      attempts: nextAttempts,
      lastError: error.message || String(error),
      nextRunAt: isDead ? schedule.nextRunAt : computeReminderBackoff(nextAttempts),
      status: isDead ? "STOPPED" : schedule.status,
      lockedBy: null,
      lockedUntil: null,
    },
  });

  return { isDead, nextAttempts };
}

async function processDueDocumentReminders(prisma, io) {
  const dueSchedules = await claimDueDocumentReminders(prisma);

  const results = {
    processed: 0,
    sent: 0,
    completed: 0,
    failed: 0,
    stopped: 0,
    errors: [],
  };

  for (const schedule of dueSchedules) {
    results.processed += 1;
    try {
      const result = await processSingleReminder(prisma, io, schedule);
      if (result.action === "sent") results.sent += 1;
      if (result.action === "completed") results.completed += 1;
      if (result.action === "stopped") results.stopped += 1;
    } catch (error) {
      results.failed += 1;
      const failure = await handleReminderFailure(prisma, schedule, error);
      results.errors.push({
        reminderId: schedule.id,
        message: error.message,
        attempts: failure.nextAttempts,
        dead: failure.isDead,
      });
    }
  }

  return results;
}

function findExistingReminderWhere({
  loanApplicationId,
  recipientType,
  reminderType,
  applicationLenderId,
}) {
  return {
    loanApplicationId,
    recipientType,
    reminderType,
    applicationLenderId:
      recipientType === "LENDER" ? applicationLenderId : null,
  };
}

async function upsertDocumentReminder(prisma, data) {
  const {
    loanApplicationId,
    brokerOrgId,
    recipientType,
    reminderType,
    applicationLenderId,
    intervalValue,
    intervalUnit,
    customMessage,
    status,
    createdByUserId,
  } = data;

  const existing = await prisma.documentReminderSchedule.findFirst({
    where: findExistingReminderWhere({
      loanApplicationId,
      recipientType,
      reminderType,
      applicationLenderId,
    }),
  });

  const now = new Date();

  if (existing) {
    const nextStatus = status || "ACTIVE";
    const wasInactive = ["PAUSED", "COMPLETED", "STOPPED"].includes(
      existing.status,
    );
    const intervalChanged =
      existing.intervalValue !== intervalValue ||
      existing.intervalUnit !== intervalUnit;

    let nextRunAt = existing.nextRunAt;
    if (nextStatus === "ACTIVE" && (wasInactive || intervalChanged)) {
      nextRunAt = immediateNextRunAt();
    }

    return prisma.documentReminderSchedule.update({
      where: { id: existing.id },
      data: {
        intervalValue,
        intervalUnit,
        customMessage: customMessage ?? existing.customMessage,
        status: nextStatus,
        nextRunAt,
        updatedAt: now,
      },
    });
  }

  return prisma.documentReminderSchedule.create({
    data: {
      loanApplicationId,
      brokerOrgId,
      recipientType,
      reminderType,
      applicationLenderId:
        recipientType === "LENDER" ? applicationLenderId : null,
      intervalValue,
      intervalUnit,
      customMessage,
      status: status || "ACTIVE",
      nextRunAt: immediateNextRunAt(),
      createdByUserId,
    },
  });
}

function serializeReminder(reminder, pendingCount = null) {
  return {
    id: reminder.id,
    loanApplicationId: reminder.loanApplicationId,
    recipientType: reminder.recipientType,
    reminderType: reminder.reminderType,
    applicationLenderId: reminder.applicationLenderId,
    intervalValue: reminder.intervalValue,
    intervalUnit: reminder.intervalUnit,
    intervalLabel: formatIntervalLabel(
      reminder.intervalValue,
      reminder.intervalUnit,
    ),
    status: reminder.status,
    customMessage: reminder.customMessage,
    lastSentAt: reminder.lastSentAt,
    nextRunAt: reminder.nextRunAt,
    pendingCount,
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt,
  };
}

module.exports = {
  REMINDER_TYPE_LABELS,
  computeNextRunAt,
  computeAnchoredNextRunAt,
  immediateNextRunAt,
  formatIntervalLabel,
  fetchPendingItems,
  processDueDocumentReminders,
  processSingleReminder,
  upsertDocumentReminder,
  serializeReminder,
  findExistingReminderWhere,
};
