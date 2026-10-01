/**
 * Unified storage facade.
 * Routes write/read to local disk or S3 based on platform config / env.
 */

const local = require("./local");
const s3 = require("./s3");
const {
  resolveStorageProvider,
  getConfiguredStorageProviderSync,
  canUseS3,
  getS3Config,
  envStorageProvider,
  invalidateStorageProviderCache,
  STORAGE_PROVIDER_KEY,
} = require("./config");

/**
 * @param {import("@prisma/client").PrismaClient} [prisma]
 */
async function getStorage(prisma) {
  const provider = await resolveStorageProvider(prisma);
  return provider === "s3" ? s3 : local;
}

function getStorageSync() {
  const provider = getConfiguredStorageProviderSync();
  return provider === "s3" ? s3 : local;
}

/**
 * Resolve driver for a specific stored object (supports mixed local/s3 history).
 * @param {"local"|"s3"|null|undefined} provider
 * @param {import("@prisma/client").PrismaClient} [prisma]
 */
async function getStorageForProvider(provider, prisma) {
  if (provider === "s3" && canUseS3()) return s3;
  if (provider === "local") return local;
  return getStorage(prisma);
}

/**
 * Infer storage key from a legacy/public fileUrl.
 * @param {string} fileUrl
 */
function keyFromFileUrl(fileUrl) {
  const raw = String(fileUrl || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const pathname = new URL(raw).pathname;
      return pathname.replace(/^\/+/, "");
    } catch {
      return null;
    }
  }
  return raw.replace(/^\/+/, "");
}

/**
 * Read file bytes from whichever provider may hold it.
 * Tries explicit provider, then local, then s3.
 */
async function getBufferFromRef({ storageKey, storageProvider, fileUrl }, prisma) {
  const key = storageKey || keyFromFileUrl(fileUrl);
  if (!key) {
    const err = new Error("File reference missing");
    err.statusCode = 404;
    throw err;
  }

  if (storageProvider === "s3" && canUseS3()) {
    return s3.getBuffer(key);
  }
  if (storageProvider === "local" || !storageProvider) {
    if (await local.exists(key)) {
      return local.getBuffer(key);
    }
  }
  if (canUseS3() && (await s3.exists(key))) {
    return s3.getBuffer(key);
  }
  if (await local.exists(key)) {
    return local.getBuffer(key);
  }
  // fallback: active provider
  const active = await getStorage(prisma);
  return active.getBuffer(key);
}

async function getStreamFromRef({ storageKey, storageProvider, fileUrl }, prisma) {
  const key = storageKey || keyFromFileUrl(fileUrl);
  if (!key) {
    const err = new Error("File reference missing");
    err.statusCode = 404;
    throw err;
  }

  if (storageProvider === "s3" && canUseS3()) {
    return s3.getStream(key);
  }
  if (storageProvider === "local" || !storageProvider) {
    if (await local.exists(key)) {
      return local.getStream(key);
    }
  }
  if (canUseS3() && (await s3.exists(key))) {
    return s3.getStream(key);
  }
  if (await local.exists(key)) {
    return local.getStream(key);
  }
  const active = await getStorage(prisma);
  return active.getStream(key);
}

function buildLoanDocumentKey({ applicationId, requirementId, fileName }) {
  const parts = ["uploads", "loan-documents"];
  if (applicationId) parts.push(String(applicationId));
  if (requirementId) parts.push(String(requirementId));
  parts.push(String(fileName));
  return parts.join("/");
}

function getStorageStatus() {
  const envProvider = envStorageProvider();
  const s3Configured = canUseS3();
  const cfg = getS3Config();
  return {
    envProvider,
    s3Configured,
    s3Bucket: cfg.bucket || null,
    s3Region: cfg.region || null,
    s3PublicBaseUrl: cfg.publicBaseUrl || null,
    secretsFromEnv: Boolean(cfg.accessKeyId && cfg.secretAccessKey),
  };
}

module.exports = {
  getStorage,
  getStorageSync,
  getStorageForProvider,
  keyFromFileUrl,
  getBufferFromRef,
  getStreamFromRef,
  buildLoanDocumentKey,
  getStorageStatus,
  invalidateStorageProviderCache,
  STORAGE_PROVIDER_KEY,
  local,
  s3,
  canUseS3,
  resolveStorageProvider: require("./config").resolveStorageProvider,
};
