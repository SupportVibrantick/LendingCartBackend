const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const prisma = require("../../config/prisma");
const { commonLogs } = require("../logger/contextLogger");
const { sendViaSmtp } = require("./providers/smtp.provider");
const { sendViaGhl } = require("./providers/ghl.provider");
const {
  DEFAULT_LOGO_PATH,
  DEFAULT_LOGO_CID,
} = require("../../utils/email/loadTemplate");

// Postgres JSONB columns corrupt large Buffers through the Prisma
// serialize/deserialize round-trip, so we never store the binary
// payload in providerMeta. If an attachment has inline `content`
// (a Buffer), we write it to a temp file, store the file path in
// providerMeta, and read the file back at dispatch time.
const LOGO_TMP_DIR = path.join(os.tmpdir(), "lendingcart-email-logos");

const persistAttachmentContent = (att) => {
  if (!att || !Buffer.isBuffer(att.content)) return att;
  try {
    if (!fs.existsSync(LOGO_TMP_DIR)) {
      fs.mkdirSync(LOGO_TMP_DIR, { recursive: true });
    }
    const id = crypto.randomBytes(8).toString("hex");
    const ext = (att.filename || "logo.bin").split(".").pop();
    const tmpPath = path.join(LOGO_TMP_DIR, `${id}.${ext}`);
    fs.writeFileSync(tmpPath, att.content);
    return { ...att, content: undefined, path: tmpPath };
  } catch (err) {
    // If we can't persist, drop the content to avoid DB corruption
    return { ...att, content: undefined };
  }
};

const restoreAttachmentContent = (att) => {
  if (!att) return att;
  // If we stored a path on disk, re-read the Buffer
  if (att.path && !att.content && /^broker-logo-/.test(att.cid || "")) {
    try {
      if (fs.existsSync(att.path)) {
        return { ...att, content: fs.readFileSync(att.path) };
      }
    } catch (err) {
      // fall through
    }
  }
  return att;
};

const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;
const LOCK_MS = 60_000;
const BATCH_SIZE = 20;

function normalizeRecipients(value) {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.join(",");
  }

  return String(value);
}

function computeNextAttempt(attempts) {
  const delaySeconds = Math.min(3600, Math.pow(2, Math.max(attempts, 1)) * 30);
  return new Date(Date.now() + delaySeconds * 1000);
}

async function enqueueEmail({
  prisma,
  to,
  cc,
  bcc,
  subject,
  text,
  html,
  templateKey,
  templateData,
  provider = "SMTP",
  providerMeta,
  attachments,
  logoAttachment,
  idempotencyKey,
  maxAttempts = 5,
}) {
  const client = prisma;

  if (!to || !subject) {
    throw new Error("enqueueEmail requires to and subject");
  }

  // Build the final attachment list:
  //   - any caller-supplied attachments
  //   - any caller-supplied logoAttachment (from loadTemplateAsync)
  //   - the platform default logo if the rendered HTML references its cid
  const finalAttachments = Array.isArray(attachments) ? [...attachments] : [];
  const htmlStr = typeof html === "string" ? html : "";

  if (
    logoAttachment &&
    !finalAttachments.some((a) => a && a.cid === logoAttachment.cid)
  ) {
    finalAttachments.push(logoAttachment);
  }

  if (
    htmlStr.includes(`cid:${DEFAULT_LOGO_CID}`) &&
    !finalAttachments.some((a) => a && a.cid === DEFAULT_LOGO_CID) &&
    fs.existsSync(DEFAULT_LOGO_PATH)
  ) {
    finalAttachments.push({
      filename: path.basename(DEFAULT_LOGO_PATH),
      path: DEFAULT_LOGO_PATH,
      cid: DEFAULT_LOGO_CID,
      contentType: "image/jpeg",
      contentDisposition: "inline",
    });
  }

  // Merge attachments into providerMeta so they survive the outbox round-trip
  // and are available at dispatch time without a schema change.
  // Inline Buffer content is written to a temp file first because
  // Postgres JSONB + Prisma cannot reliably round-trip large Buffers.
  const meta = { ...(providerMeta || {}) };
  if (finalAttachments.length) {
    meta.attachments = finalAttachments.map(persistAttachmentContent);
  }

  if (idempotencyKey) {
    const existing = await client.emailOutbox.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return existing;
    }
  }

  try {
    return await client.emailOutbox.create({
      data: {
        to: normalizeRecipients(to),
        cc: normalizeRecipients(cc),
        bcc: normalizeRecipients(bcc),
        subject,
        text: text || null,
        html: html || null,
        templateKey: templateKey || null,
        templateData: templateData || undefined,
        provider,
        providerMeta: Object.keys(meta).length ? meta : undefined,
        idempotencyKey: idempotencyKey || null,
        maxAttempts,
      },
    });
  } catch (error) {
    if (idempotencyKey && error.code === "P2002") {
      return client.emailOutbox.findUnique({
        where: { idempotencyKey },
      });
    }

    throw error;
  }
}

async function enqueueGhlEmail(options) {
  return enqueueEmail({
    ...options,
    provider: "GHL",
  });
}

async function dispatchOutboxRecord(record) {
  const providerMeta = record.providerMeta || {};
  const attachments = Array.isArray(providerMeta.attachments)
    ? providerMeta.attachments.map(restoreAttachmentContent)
    : undefined;

  if (record.provider === "GHL") {
    return sendViaGhl({
      to: record.to,
      subject: record.subject,
      text: record.text,
      html: record.html,
      providerMeta,
    });
  }

  return sendViaSmtp({
    to: record.to,
    cc: record.cc,
    bcc: record.bcc,
    subject: record.subject,
    text: record.text,
    html: record.html,
    attachments,
  });
}

async function claimOutboxBatch(prisma) {
  const now = new Date();
  const candidates = await prisma.emailOutbox.findMany({
    where: {
      nextAttemptAt: { lte: now },
      OR: [
        {
          status: { in: ["PENDING", "FAILED"] },
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
        },
        {
          status: "PROCESSING",
          lockedUntil: { lt: now },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  const claimed = [];

  for (const record of candidates) {
    if (record.attempts >= record.maxAttempts) {
      continue;
    }

    const lockUntil = new Date(Date.now() + LOCK_MS);
    const updated = await prisma.emailOutbox.updateMany({
      where: {
        id: record.id,
        status: record.status,
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      },
      data: {
        status: "PROCESSING",
        lockedBy: WORKER_ID,
        lockedUntil: lockUntil,
      },
    });

    if (updated.count === 1) {
      claimed.push(
        await prisma.emailOutbox.findUnique({
          where: { id: record.id },
        }),
      );
    }
  }

  return claimed.filter(Boolean);
}

async function processOutboxRecord(prisma, record) {
  try {
    await dispatchOutboxRecord(record);

    return prisma.emailOutbox.update({
      where: { id: record.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        lastError: null,
        lockedBy: null,
        lockedUntil: null,
      },
    });
  } catch (error) {
    const nextAttempts = record.attempts + 1;
    const isDead = nextAttempts >= record.maxAttempts;

    return prisma.emailOutbox.update({
      where: { id: record.id },
      data: {
        status: isDead ? "DEAD" : "FAILED",
        attempts: nextAttempts,
        lastError: error.message || String(error),
        nextAttemptAt: isDead ? record.nextAttemptAt : computeNextAttempt(nextAttempts),
        lockedBy: null,
        lockedUntil: null,
      },
    });
  }
}

async function processEmailOutbox(prisma) {
  const client = prisma;
  const claimed = await claimOutboxBatch(client);

  for (const record of claimed) {
    await processOutboxRecord(client, record);
  }

  return claimed.length;
}

async function listEmailOutbox(prisma, { status, limit = 50, offset = 0 } = {}) {
  const client = prisma;

  return client.emailOutbox.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    skip: offset,
  });
}

function startEmailOutboxWorker(prisma, intervalMs = 15_000) {
  const client = prisma;

  const tick = async () => {
    try {
      const processed = await processEmailOutbox(client);
      if (processed > 0) {
        commonLogs.info(`Processed ${processed} email outbox job(s)`);
      }
    } catch (error) {
      commonLogs.error("Email outbox worker tick failed", { error });
    }
  };

  tick();
  return setInterval(tick, intervalMs);
}

module.exports = {
  enqueueEmail,
  enqueueGhlEmail,
  processEmailOutbox,
  listEmailOutbox,
  startEmailOutboxWorker,
};
