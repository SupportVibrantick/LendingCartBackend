const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;

function getWorkerId() {
  return WORKER_ID;
}

/**
 * Acquire a distributed DB lock for a named cron job.
 * Uses raw SQL so locks work even before `prisma generate` picks up JobLock.
 */
async function acquireJobLock(
  prisma,
  jobName,
  { ttlMs = 5 * 60 * 1000, workerId = WORKER_ID } = {},
) {
  if (!prisma?.$executeRaw) {
    throw new Error("acquireJobLock requires a Prisma client");
  }

  const now = new Date();
  const lockedUntil = new Date(now.getTime() + ttlMs);

  const updated = await prisma.$executeRaw`
    UPDATE "job_locks"
    SET "lockedBy" = ${workerId},
        "lockedUntil" = ${lockedUntil},
        "updatedAt" = ${now}
    WHERE "name" = ${jobName}
      AND ("lockedUntil" IS NULL OR "lockedUntil" < ${now})
  `;

  if (Number(updated) >= 1) {
    return { acquired: true, workerId };
  }

  try {
    await prisma.$executeRaw`
      INSERT INTO "job_locks" ("name", "lockedBy", "lockedUntil", "updatedAt")
      VALUES (${jobName}, ${workerId}, ${lockedUntil}, ${now})
    `;
    return { acquired: true, workerId };
  } catch (error) {
    if (error.code === "P2010" && error.meta?.code === "23505") {
      return { acquired: false, workerId };
    }
    if (error.code === "23505") {
      return { acquired: false, workerId };
    }

    if (error.message?.includes("job_locks") && error.message?.includes("does not exist")) {
      throw new Error(
        'job_locks table is missing. Run: npx prisma migrate deploy',
      );
    }

    throw error;
  }
}

async function releaseJobLock(prisma, jobName, workerId = WORKER_ID) {
  if (!prisma?.$executeRaw) {
    return;
  }

  const now = new Date();

  await prisma.$executeRaw`
    UPDATE "job_locks"
    SET "lockedBy" = NULL,
        "lockedUntil" = NULL,
        "updatedAt" = ${now}
    WHERE "name" = ${jobName}
      AND "lockedBy" = ${workerId}
  `;
}

module.exports = {
  getWorkerId,
  acquireJobLock,
  releaseJobLock,
};
