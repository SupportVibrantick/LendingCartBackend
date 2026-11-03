/**
 * In-memory set of verified custom-domain hostnames for CORS / Socket.IO.
 * Refreshed periodically and after domain verify/update.
 */

let hostnames = new Set();
let loadedAt = 0;
let loading = null;
const TTL_MS = 5 * 60 * 1000;

function normalizeHostname(value) {
  if (!value) return "";
  let raw = String(value).trim().toLowerCase();
  if (!raw) return "";
  try {
    if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
      raw = new URL(raw.startsWith("//") ? `https:${raw}` : raw).hostname;
    }
  } catch {
    raw = raw.replace(/^https?:\/\//i, "").split("/")[0];
  }
  return raw.replace(/\.$/, "");
}

async function refreshFromDb(prisma) {
  if (!prisma?.brokerWhiteLabelSetting) {
    hostnames = new Set();
    loadedAt = Date.now();
    return hostnames;
  }

  const rows = await prisma.brokerWhiteLabelSetting.findMany({
    where: {
      domainVerified: true,
      customDomain: { not: null },
    },
    select: { customDomain: true },
  });

  hostnames = new Set(
    rows
      .map((r) => normalizeHostname(r.customDomain))
      .filter(Boolean),
  );
  loadedAt = Date.now();
  return hostnames;
}

async function ensureLoaded(prisma) {
  if (Date.now() - loadedAt < TTL_MS && loadedAt > 0) {
    return hostnames;
  }
  if (loading) return loading;
  loading = refreshFromDb(prisma)
    .catch(() => hostnames)
    .finally(() => {
      loading = null;
    });
  return loading;
}

function rememberHostname(hostname) {
  const clean = normalizeHostname(hostname);
  if (clean) hostnames.add(clean);
}

function forgetHostname(hostname) {
  const clean = normalizeHostname(hostname);
  if (clean) hostnames.delete(clean);
}

function isVerifiedCustomDomainHostname(hostname) {
  const clean = normalizeHostname(hostname);
  return Boolean(clean && hostnames.has(clean));
}

function isVerifiedCustomDomainOrigin(origin) {
  if (!origin) return false;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "https:" && protocol !== "http:") return false;
    return isVerifiedCustomDomainHostname(hostname);
  } catch {
    return false;
  }
}

module.exports = {
  ensureLoaded,
  refreshFromDb,
  rememberHostname,
  forgetHostname,
  isVerifiedCustomDomainHostname,
  isVerifiedCustomDomainOrigin,
  normalizeHostname,
};
