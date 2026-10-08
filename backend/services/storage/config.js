/**
 * Resolve active storage provider (local | s3).
 * Priority: PlatformConfig DB override → STORAGE_PROVIDER env →
 * s3 in production when a bucket is set → local.
 */

const STORAGE_PROVIDER_KEY = "storage.provider";

let cached = {
  provider: null,
  expiresAt: 0,
};

const CACHE_TTL_MS = 30_000;

function envStorageProvider() {
  const raw = String(process.env.STORAGE_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (raw === "s3" || raw === "local") return raw;

  // Production with S3 credentials and no explicit provider writes new files to S3.
  // Reads still check local disk first (see routes/common/storageProxy.js).
  if (process.env.NODE_ENV === "production" && isS3Configured()) {
    return "s3";
  }

  return "local";
}

function getS3Config() {
  const bucket = String(process.env.S3_BUCKET || "").trim();
  const region = String(process.env.AWS_REGION || process.env.S3_REGION || "")
    .trim();
  const publicBaseUrl = String(process.env.S3_PUBLIC_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const accessKeyId = String(process.env.AWS_ACCESS_KEY_ID || "").trim() || null;
  const secretAccessKey =
    String(process.env.AWS_SECRET_ACCESS_KEY || "").trim() || null;
  const endpoint = String(process.env.S3_ENDPOINT || "").trim() || null;
  const forcePathStyle = ["true", "1"].includes(
    String(process.env.S3_FORCE_PATH_STYLE || "").trim().toLowerCase(),
  );

  return {
    bucket,
    region: region || "us-east-1",
    publicBaseUrl: publicBaseUrl || null,
    accessKeyId,
    secretAccessKey,
    endpoint,
    forcePathStyle,
  };
}

function isS3Configured() {
  const { bucket, region } = getS3Config();
  return Boolean(bucket && region);
}

function canUseS3() {
  return isS3Configured();
}

function invalidateStorageProviderCache() {
  cached = { provider: null, expiresAt: 0 };
}

/**
 * @param {import("@prisma/client").PrismaClient} [prisma]
 * @returns {Promise<"local"|"s3">}
 */
async function resolveStorageProvider(prisma) {
  const now = Date.now();
  if (cached.provider && cached.expiresAt > now) {
    return cached.provider;
  }

  let provider = envStorageProvider();

  if (prisma) {
    try {
      const row = await prisma.platformConfig.findUnique({
        where: { key: STORAGE_PROVIDER_KEY },
        select: { value: true },
      });
      const override = String(row?.value || "")
        .trim()
        .toLowerCase();
      if (override === "local" || override === "s3") {
        provider = override;
      }
    } catch {
      // Table may not exist yet during migrate; fall back to env.
    }
  }

  if (provider === "s3" && !canUseS3()) {
    provider = "local";
  }

  cached = { provider, expiresAt: now + CACHE_TTL_MS };
  return provider;
}

/**
 * Sync helper when prisma is unavailable (e.g. early boot).
 * @returns {"local"|"s3"}
 */
function getConfiguredStorageProviderSync() {
  const provider = envStorageProvider();
  if (provider === "s3" && !canUseS3()) return "local";
  return provider;
}

module.exports = {
  STORAGE_PROVIDER_KEY,
  envStorageProvider,
  getS3Config,
  isS3Configured,
  canUseS3,
  resolveStorageProvider,
  getConfiguredStorageProviderSync,
  invalidateStorageProviderCache,
};
