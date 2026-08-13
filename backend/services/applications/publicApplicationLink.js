const crypto = require("crypto");

const SOURCE_PORTALS = Object.freeze({
  BROKER: "BROKER",
  LOAN_OFFICER: "LOAN_OFFICER",
  CO_BROKER: "CO_BROKER",
  LEGACY: "LEGACY",
});

const LINK_SOURCE_PORTALS = Object.freeze({
  BROKER: "BROKER",
  LOAN_OFFICER: "LOAN_OFFICER",
  CO_BROKER: "CO_BROKER",
});

function generatePublicApplicationLinkToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function buildPublicApplicationSharePath(token) {
  return `/get-loan?ref=${encodeURIComponent(token)}`;
}

function shouldShowCoBrokerBorrowerInformationTab(sourcePortal) {
  return (
    sourcePortal === SOURCE_PORTALS.BROKER ||
    sourcePortal === SOURCE_PORTALS.LOAN_OFFICER
  );
}

function isPublicApplicationLinkUsable(link, now = new Date()) {
  if (!link) {
    return { ok: false, code: "NOT_FOUND", message: "Invalid application link" };
  }

  if (link.isActive === false || link.revokedAt) {
    return {
      ok: false,
      code: "REVOKED",
      message: "This application link has been revoked",
    };
  }

  if (link.expiresAt && new Date(link.expiresAt).getTime() <= now.getTime()) {
    return {
      ok: false,
      code: "EXPIRED",
      message: "This application link has expired",
    };
  }

  return { ok: true };
}

function normalizeSourcePortalOption(sourcePortal) {
  const value = String(sourcePortal || "").trim().toUpperCase();
  if (value === LINK_SOURCE_PORTALS.LOAN_OFFICER) {
    return LINK_SOURCE_PORTALS.LOAN_OFFICER;
  }
  if (value === LINK_SOURCE_PORTALS.CO_BROKER) {
    return LINK_SOURCE_PORTALS.CO_BROKER;
  }
  return LINK_SOURCE_PORTALS.BROKER;
}

/**
 * Mint or reuse a stable active link for (org, creator, portal).
 */
async function getOrCreatePublicApplicationLink(
  prisma,
  {
    brokerOrganizationId,
    createdByUserId,
    sourcePortal,
    expiresAt = null,
  },
) {
  const portal = normalizeSourcePortalOption(sourcePortal);
  const loanOfficerId =
    portal === LINK_SOURCE_PORTALS.LOAN_OFFICER ? createdByUserId : null;
  const coBrokerId =
    portal === LINK_SOURCE_PORTALS.CO_BROKER ? createdByUserId : null;

  const existing = await prisma.publicApplicationLink.findFirst({
    where: {
      brokerOrganizationId,
      createdByUserId,
      sourcePortal: portal,
      isActive: true,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.publicApplicationLink.create({
    data: {
      id: crypto.randomUUID(),
      token: generatePublicApplicationLinkToken(),
      brokerOrganizationId,
      sourcePortal: portal,
      createdByUserId,
      loanOfficerId,
      coBrokerId,
      isActive: true,
      expiresAt,
    },
  });
}

async function resolvePublicApplicationLinkByToken(prisma, rawToken) {
  const token = String(rawToken || "").trim();
  if (!token) {
    return {
      ok: false,
      status: 400,
      code: "MISSING_REF",
      message: "Application link ref is required",
    };
  }

  const link = await prisma.publicApplicationLink.findUnique({
    where: { token },
    include: {
      brokerOrganization: {
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
          status: true,
        },
      },
    },
  });

  const usability = isPublicApplicationLinkUsable(link);
  if (!usability.ok) {
    return {
      ok: false,
      status: usability.code === "NOT_FOUND" ? 404 : 410,
      code: usability.code,
      message: usability.message,
    };
  }

  if (
    !link.brokerOrganization ||
    link.brokerOrganization.type !== "BROKER" ||
    link.brokerOrganization.status !== "ACTIVE"
  ) {
    return {
      ok: false,
      status: 404,
      code: "ORG_INACTIVE",
      message: "Broker organization is not available for this link",
    };
  }

  return {
    ok: true,
    link,
    brokerOrganizationId: link.brokerOrganizationId,
    sourcePortal: link.sourcePortal,
    createdByUserId: link.createdByUserId,
    loanOfficerId: link.loanOfficerId || null,
    coBrokerId: link.coBrokerId || null,
    showCoBrokerBorrowerInformationTab:
      shouldShowCoBrokerBorrowerInformationTab(link.sourcePortal),
  };
}

async function touchPublicApplicationLink(prisma, linkId) {
  if (!linkId) return;
  await prisma.publicApplicationLink.update({
    where: { id: linkId },
    data: { lastUsedAt: new Date() },
  });
}

function buildLoanApplicationProvenanceFromLink(link) {
  if (!link) {
    return {
      publicApplicationLinkId: null,
      publicSourcePortal: SOURCE_PORTALS.LEGACY,
      publicCreatedByUserId: null,
      brokerUserId: null,
      assignCoBrokerId: null,
    };
  }

  return {
    publicApplicationLinkId: link.id,
    publicSourcePortal: link.sourcePortal,
    publicCreatedByUserId: link.createdByUserId,
    brokerUserId:
      link.sourcePortal === LINK_SOURCE_PORTALS.LOAN_OFFICER
        ? link.loanOfficerId || link.createdByUserId
        : null,
    assignCoBrokerId:
      link.sourcePortal === LINK_SOURCE_PORTALS.CO_BROKER
        ? link.coBrokerId || link.createdByUserId
        : null,
  };
}

module.exports = {
  SOURCE_PORTALS,
  LINK_SOURCE_PORTALS,
  generatePublicApplicationLinkToken,
  buildPublicApplicationSharePath,
  shouldShowCoBrokerBorrowerInformationTab,
  isPublicApplicationLinkUsable,
  normalizeSourcePortalOption,
  getOrCreatePublicApplicationLink,
  resolvePublicApplicationLinkByToken,
  touchPublicApplicationLink,
  buildLoanApplicationProvenanceFromLink,
};
