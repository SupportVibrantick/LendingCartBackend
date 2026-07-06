const { PrismaClient } = require("@prisma/client");
const { commonLogs } = require("../logger/contextLogger");
const { sendViaSmtp } = require("./providers/smtp.provider");
const { sendViaGhl } = require("./providers/ghl.provider");

const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;
const LOCK_MS = 60_000;
const BATCH_SIZE = 20;

let sharedPrisma;

function getPrisma(explicitPrisma) {
  if (explicitPrisma) {
    return explicitPrisma;
  }

  if (!sharedPrisma) {
    sharedPrisma = new PrismaClient();
  }

  return sharedPrisma;
}

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
  idempotencyKey,
  maxAttempts = 5,
}) {
  const client = getPrisma(prisma);

  if (!to || !subject) {
    throw new Error("enqueueEmail requires to and subject");
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
        providerMeta: providerMeta || undefined,
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
  if (record.provider === "GHL") {
    return sendViaGhl({
      to: record.to,
      subject: record.subject,
      text: record.text,
      html: record.html,
      providerMeta: record.providerMeta || {},
    });
  }

  return sendViaSmtp({
    to: record.to,
    cc: record.cc,
    bcc: record.bcc,
    subject: record.subject,
    text: record.text,
    html: record.html,
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
  const client = getPrisma(prisma);
  const claimed = await claimOutboxBatch(client);

  for (const record of claimed) {
    await processOutboxRecord(client, record);
  }

  return claimed.length;
}

async function listEmailOutbox(prisma, { status, limit = 50, offset = 0 } = {}) {
  const client = getPrisma(prisma);

  return client.emailOutbox.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    skip: offset,
  });
}

function startEmailOutboxWorker(prisma, intervalMs = 15_000) {
  const client = getPrisma(prisma);

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
