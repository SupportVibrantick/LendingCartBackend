const crypto = require("crypto");
const dns = require("dns").promises;

const HOSTNAME_RE =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

function stripTrailingSlash(value) {
  return value == null ? "" : String(value).replace(/\/$/, "");
}

function ensureAbsoluteUrl(url) {
  if (!url) return "";
  const trimmed = String(url).trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (
    trimmed.startsWith("localhost") ||
    trimmed.startsWith("127.0.0.1") ||
    trimmed.startsWith("0.0.0.0")
  ) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

/**
 * Normalize user input into a bare hostname (no protocol/path/port).
 * Empty / whitespace → null (clear domain).
 */
function normalizeCustomDomain(input) {
  if (input == null) return null;
  let raw = String(input).trim().toLowerCase();
  if (!raw) return null;

  raw = raw.replace(/^https?:\/\//i, "");
  raw = raw.split("/")[0];
  raw = raw.split("?")[0];
  raw = raw.split("#")[0];
  raw = raw.replace(/\.$/, "");

  // Drop accidental port
  if (raw.includes(":") && !raw.startsWith("[")) {
    raw = raw.split(":")[0];
  }

  if (!HOSTNAME_RE.test(raw)) {
    const err = new Error(
      "Enter a valid domain like apply.yourbroker.com (no https:// or path).",
    );
    err.statusCode = 400;
    throw err;
  }

  return raw;
}

function getCnameTarget() {
  return String(process.env.CUSTOM_DOMAIN_CNAME_TARGET || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
}

function getATarget() {
  return String(process.env.CUSTOM_DOMAIN_A_TARGET || "").trim();
}

function forceHttps() {
  const raw = process.env.CUSTOM_DOMAIN_FORCE_HTTPS;
  if (raw == null || raw === "") return true;
  return !["0", "false", "no", "off"].includes(String(raw).toLowerCase());
}

function buildCustomDomainBaseUrl(hostname) {
  if (!hostname) return null;
  const host = String(hostname).trim().toLowerCase();
  if (!host) return null;
  const protocol = forceHttps() ? "https" : "http";
  return `${protocol}://${host}`;
}

function buildVerificationToken(brokerOrgId) {
  const secret = process.env.JWT_SECRET || "loanautomation";
  return crypto
    .createHash("sha256")
    .update(`custom-domain:${brokerOrgId}:${secret}`)
    .digest("hex")
    .slice(0, 32);
}

function getDnsInstructions(hostname, brokerOrgId) {
  const domain = hostname || null;
  const cnameTarget = getCnameTarget();
  const aTarget = getATarget();
  const txtHost = domain ? `_loanautomation-challenge.${domain}` : null;
  const txtValue = brokerOrgId ? buildVerificationToken(brokerOrgId) : null;

  return {
    hostname: domain,
    cname: cnameTarget
      ? {
          host: domain,
          type: "CNAME",
          value: cnameTarget,
          required: true,
        }
      : null,
    a: aTarget
      ? {
          host: domain,
          type: "A",
          value: aTarget,
          required: !cnameTarget,
        }
      : null,
    txt:
      txtHost && txtValue
        ? {
            host: txtHost,
            type: "TXT",
            value: txtValue,
            required: !cnameTarget && !aTarget,
          }
        : null,
    notes: [
      cnameTarget
        ? `Create a CNAME record that points your hostname to ${cnameTarget}.`
        : "Create the TXT record below to prove you own this domain.",
    ].filter(Boolean),
  };
}

function hostnameMatchesTarget(resolved, target) {
  if (!resolved || !target) return false;
  const a = String(resolved).toLowerCase().replace(/\.$/, "");
  const b = String(target).toLowerCase().replace(/\.$/, "");
  return a === b;
}

async function resolveCnameChain(hostname, depth = 0) {
  if (!hostname || depth > 8) return [];
  try {
    const records = await dns.resolveCname(hostname);
    const out = [];
    for (const record of records || []) {
      const clean = String(record).toLowerCase().replace(/\.$/, "");
      out.push(clean);
      const nested = await resolveCnameChain(clean, depth + 1);
      out.push(...nested);
    }
    return out;
  } catch (err) {
    if (err && (err.code === "ENODATA" || err.code === "ENOTFOUND")) {
      return [];
    }
    throw err;
  }
}

async function resolveTxtValues(hostname) {
  try {
    const records = await dns.resolveTxt(hostname);
    return (records || [])
      .map((chunks) => (Array.isArray(chunks) ? chunks.join("") : String(chunks)))
      .map((v) => v.trim());
  } catch (err) {
    if (err && (err.code === "ENODATA" || err.code === "ENOTFOUND")) {
      return [];
    }
    throw err;
  }
}

async function resolveARecords(hostname) {
  try {
    return await dns.resolve4(hostname);
  } catch (err) {
    if (err && (err.code === "ENODATA" || err.code === "ENOTFOUND")) {
      return [];
    }
    throw err;
  }
}

/**
 * Check public DNS for CNAME / A / TXT proof that this hostname belongs to the org.
 */
async function checkDomainDns(hostname, brokerOrgId) {
  const cnameTarget = getCnameTarget();
  const aTarget = getATarget();
  const expectedTxt = buildVerificationToken(brokerOrgId);
  const details = {
    cnameRecords: [],
    aRecords: [],
    txtRecords: [],
    matched: {
      cname: false,
      a: false,
      txt: false,
    },
  };

  try {
    details.cnameRecords = await resolveCnameChain(hostname);
    details.matched.cname = details.cnameRecords.some((r) =>
      hostnameMatchesTarget(r, cnameTarget),
    );
  } catch (err) {
    details.cnameError = err.message;
  }

  try {
    details.aRecords = await resolveARecords(hostname);
    details.matched.a = Boolean(aTarget) && details.aRecords.includes(aTarget);
  } catch (err) {
    details.aError = err.message;
  }

  try {
    details.txtRecords = await resolveTxtValues(
      `_loanautomation-challenge.${hostname}`,
    );
    details.matched.txt = details.txtRecords.includes(expectedTxt);
  } catch (err) {
    details.txtError = err.message;
  }

  const configuredProof = Boolean(cnameTarget || aTarget);
  const verified = configuredProof
    ? details.matched.cname || details.matched.a || details.matched.txt
    : details.matched.txt;

  return { verified, details, expectedTxt, cnameTarget, aTarget };
}

async function getWhiteLabelDomainRow(prisma, brokerOrgId) {
  if (!prisma || !brokerOrgId) return null;
  return prisma.brokerWhiteLabelSetting.findFirst({
    where: { brokerOrgId },
    select: {
      id: true,
      customDomain: true,
      domainVerified: true,
      sslStatus: true,
    },
  });
}

/**
 * Verified custom domain origin (https://hostname) or null → callers keep platform fallback.
 */
async function getVerifiedCustomDomainBaseUrl(prisma, brokerOrgId) {
  const row = await getWhiteLabelDomainRow(prisma, brokerOrgId);
  if (!row?.customDomain || !row.domainVerified) return null;
  return buildCustomDomainBaseUrl(row.customDomain);
}

/**
 * Prefer verified custom domain; otherwise use the provided platform fallback.
 */
async function resolveBrokerPublicBaseUrl(prisma, brokerOrgId, { fallback } = {}) {
  const custom = await getVerifiedCustomDomainBaseUrl(prisma, brokerOrgId);
  if (custom) return stripTrailingSlash(custom);
  return stripTrailingSlash(fallback || "");
}

module.exports = {
  normalizeCustomDomain,
  getCnameTarget,
  getDnsInstructions,
  buildCustomDomainBaseUrl,
  buildVerificationToken,
  checkDomainDns,
  getVerifiedCustomDomainBaseUrl,
  resolveBrokerPublicBaseUrl,
  ensureAbsoluteUrl,
  stripTrailingSlash,
};
