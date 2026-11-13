const { hardDeleteLenderOrg } = require("./hardDeleteLender");
const { adminLogs } = require("../logger/contextLogger");

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_BATCH_SIZE = 25;

function getDeletedLenderRetentionDays() {
  const raw = Number(process.env.DELETED_LENDER_RETENTION_DAYS);
  if (Number.isFinite(raw) && raw >= 1) return Math.floor(raw);
  return DEFAULT_RETENTION_DAYS;
}

function getPurgeCutoffDate(now = new Date()) {
  const days = getDeletedLenderRetentionDays();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function getPurgeAt(deletedAt, now = new Date()) {
  if (!deletedAt) return null;
  const days = getDeletedLenderRetentionDays();
  const purgeAt = new Date(
    new Date(deletedAt).getTime() + days * 24 * 60 * 60 * 1000,
  );
  const msLeft = purgeAt.getTime() - now.getTime();
  const daysUntilPurge = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  return { purgeAt, daysUntilPurge, retentionDays: days };
}

/**
 * Permanently delete soft-deleted lenders past the retention window.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ log?: any, now?: Date, limit?: number }} [options]
 */
async function purgeExpiredDeletedLenders(prisma, options = {}) {
  const log = options.log || adminLogs;
  const now = options.now || new Date();
  const limit = Math.min(
    100,
    Math.max(1, Number(options.limit) || DEFAULT_BATCH_SIZE),
  );
  const retentionDays = getDeletedLenderRetentionDays();
  const cutoff = getPurgeCutoffDate(now);

  const expired = await prisma.organization.findMany({
    where: {
      type: "LENDER",
      isDeleted: true,
      deletedAt: { lte: cutoff },
    },
    select: { id: true, name: true, deletedAt: true },
    orderBy: { deletedAt: "asc" },
    take: limit,
  });

  let purged = 0;
  let failed = 0;
  const errors = [];

  for (const lender of expired) {
    try {
      await hardDeleteLenderOrg(prisma, lender.id);
      purged += 1;
      log.info?.("Purged expired deleted lender", {
        lenderOrgId: lender.id,
        name: lender.name,
        deletedAt: lender.deletedAt,
        retentionDays,
      });
    } catch (error) {
      failed += 1;
      errors.push({
        lenderOrgId: lender.id,
        message: error?.message || "Unknown error",
      });
      log.error?.("Failed to purge deleted lender", {
        lenderOrgId: lender.id,
        name: lender.name,
        error: error?.message,
      });
    }
  }

  return {
    retentionDays,
    cutoff: cutoff.toISOString(),
    scanned: expired.length,
    purged,
    failed,
    errors: errors.length ? errors : undefined,
  };
}

module.exports = {
  purgeExpiredDeletedLenders,
  getDeletedLenderRetentionDays,
  getPurgeCutoffDate,
  getPurgeAt,
};
