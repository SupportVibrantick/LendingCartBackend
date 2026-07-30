const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeCompanyName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function extractWebsiteDomain(website) {
  const raw = String(website || "").trim();
  if (!raw) return "";

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const hostname = new URL(withProtocol).hostname.toLowerCase();
    return hostname.replace(/^www\./, "");
  } catch {
    const cleaned = raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .toLowerCase();
    return cleaned;
  }
}

function domainsMatch(a, b) {
  const left = extractWebsiteDomain(a);
  const right = extractWebsiteDomain(b);
  return Boolean(left && right && left === right);
}

async function findLenderOrgByEmail(prisma, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const byOrgEmail = await prisma.organization.findFirst({
    where: {
      type: "LENDER",
      isDeleted: { not: true },
      email: { equals: normalized, mode: "insensitive" },
    },
    select: orgSelect(),
  });
  if (byOrgEmail) {
    return { org: byOrgEmail, matchReason: "email" };
  }

  const byUser = await prisma.userAccount.findFirst({
    where: {
      email: normalized,
      isDeleted: false,
      organization: { type: "LENDER", isDeleted: { not: true } },
    },
    select: {
      organization: { select: orgSelect() },
    },
  });
  if (byUser?.organization) {
    return { org: byUser.organization, matchReason: "email" };
  }

  const byInvite = await prisma.adminLenderInvite.findFirst({
    where: {
      email: normalized,
      status: { in: ["PENDING", "ACCEPTED"] },
      lenderOrgId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      lenderOrg: { select: orgSelect() },
    },
  });
  if (byInvite?.lenderOrg) {
    return { org: byInvite.lenderOrg, matchReason: "email" };
  }

  return null;
}

async function findLenderOrgByWebsiteDomain(prisma, website) {
  const domain = extractWebsiteDomain(website);
  if (!domain) return null;

  const profiles = await prisma.lenderProfile.findMany({
    where: {
      website: { not: null },
      lender: { type: "LENDER", isDeleted: { not: true } },
    },
    select: {
      website: true,
      lender: { select: orgSelect() },
    },
    take: 500,
  });

  for (const profile of profiles) {
    if (domainsMatch(profile.website, domain)) {
      return { org: profile.lender, matchReason: "website" };
    }
  }

  return null;
}

async function findLenderOrgByCompanyName(prisma, companyName) {
  const normalized = normalizeCompanyName(companyName);
  if (!normalized) return null;

  const org = await prisma.organization.findFirst({
    where: {
      type: "LENDER",
      isDeleted: { not: true },
      name: { equals: normalized, mode: "insensitive" },
    },
    select: orgSelect(),
  });

  if (!org) return null;
  return { org, matchReason: "companyName" };
}

function orgSelect() {
  return {
    id: true,
    name: true,
    email: true,
    phone: true,
    status: true,
    lenderProfile: {
      select: {
        profileStatus: true,
        isVisible: true,
        website: true,
      },
    },
  };
}

/**
 * Mandatory duplicate check — priority: email → website domain → company name.
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ companyName: string, businessEmail: string, website?: string }} input
 * @param {string} [brokerOrgId]
 */
async function findDuplicateLender(prisma, input, brokerOrgId) {
  const companyName = normalizeCompanyName(input.companyName);
  const businessEmail = normalizeEmail(input.businessEmail);
  const website = String(input.website || "").trim();

  let match =
    (await findLenderOrgByEmail(prisma, businessEmail)) ||
    (await findLenderOrgByWebsiteDomain(prisma, website)) ||
    (await findLenderOrgByCompanyName(prisma, companyName));

  if (!match?.org) {
    return { duplicate: false };
  }

  let isConnected = false;
  if (brokerOrgId) {
    const access = await prisma.brokerLenderAccess.findFirst({
      where: {
        brokerOrgId,
        lenderOrgId: match.org.id,
        isActive: true,
      },
      select: { id: true },
    });
    isConnected = Boolean(access);
  }

  return {
    duplicate: true,
    matchReason: match.matchReason,
    lender: {
      id: match.org.id,
      name: match.org.name,
      email: match.org.email,
      phone: match.org.phone,
      status: match.org.status,
      profileStatus: match.org.lenderProfile?.profileStatus || null,
      isVisible: match.org.lenderProfile?.isVisible ?? false,
      website: match.org.lenderProfile?.website || null,
      isConnected,
    },
  };
}

module.exports = {
  EMAIL_REGEX,
  normalizeEmail,
  normalizeCompanyName,
  extractWebsiteDomain,
  findDuplicateLender,
};
