const { randomUUID } = require("crypto");
const {
  isGenericClientName,
} = require("../../utils/applications/resolveBorrowerIdentity");

function normalizeClientEmail(email) {
  if (email == null) return "";
  return String(email).trim().toLowerCase();
}

function normalizePersonName(value) {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

function buildDisplayName({ firstName, lastName, displayName, legalName }) {
  const fromParts = `${normalizePersonName(firstName)} ${normalizePersonName(
    lastName,
  )}`.trim();
  return (
    normalizePersonName(displayName) ||
    fromParts ||
    normalizePersonName(legalName) ||
    ""
  );
}

function namesDiffer(existingName, incomingName) {
  const left = normalizePersonName(existingName).toLowerCase();
  const right = normalizePersonName(incomingName).toLowerCase();
  if (!left || !right) return false;
  if (isGenericClientName(left) || isGenericClientName(right)) return false;
  return left !== right;
}

function contactMatchesEmail(contact, email) {
  return normalizeClientEmail(contact?.email) === email;
}

/**
 * Find an existing borrower Client for this broker org + email, or create one.
 * Never creates/merges ClientPortalUser rows. Never silently overwrites a real name.
 *
 * @param {import("@prisma/client").Prisma.TransactionClient | import("@prisma/client").PrismaClient} tx
 * @param {{
 *   brokerOrgId: string,
 *   email: string,
 *   firstName?: string,
 *   lastName?: string,
 *   displayName?: string,
 *   logger?: { warn?: Function, info?: Function },
 * }} params
 */
async function findOrCreateBorrowerClient(
  tx,
  {
    brokerOrgId,
    email,
    firstName = "",
    lastName = "",
    displayName = "",
    logger = null,
  },
) {
  const normalizedEmail = normalizeClientEmail(email);
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }
  if (!brokerOrgId) {
    throw new Error("brokerOrgId is required");
  }

  const incomingFirst = normalizePersonName(firstName) || "Applicant";
  const incomingLast = normalizePersonName(lastName);
  const incomingDisplay =
    buildDisplayName({
      firstName: incomingFirst,
      lastName: incomingLast,
      displayName,
    }) || "Individual Applicant";

  // Serialize concurrent same-email creates within this broker org (Postgres).
  const lockKey = `lc:borrower-client:${brokerOrgId}:${normalizedEmail}`;
  if (typeof tx.$executeRaw === "function") {
    try {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    } catch {
      // Non-Postgres / test mocks — continue without lock.
    }
  }

  const existing = await findExistingBorrowerClient(tx, {
    brokerOrgId,
    email: normalizedEmail,
  });

  if (existing) {
    return reuseExistingClient(tx, {
      client: existing,
      email: normalizedEmail,
      incomingFirst,
      incomingLast,
      incomingDisplay,
      logger,
    });
  }

  const created = await tx.client.create({
    data: {
      id: randomUUID(),
      legalName: incomingDisplay,
      entityType: "INDIVIDUAL",
      primaryBrokerOrgId: brokerOrgId,
      contacts: {
        create: {
          firstName: incomingFirst,
          lastName: incomingLast,
          email: normalizedEmail,
          isPrimary: true,
        },
      },
    },
    include: { contacts: true },
  });

  return {
    client: created,
    reused: false,
    nameMismatch: false,
    warnings: [],
    email: normalizedEmail,
  };
}

async function findExistingBorrowerClient(tx, { brokerOrgId, email }) {
  const portalUser = await tx.clientPortalUser.findFirst({
    where: {
      OR: [{ email }, { email: { equals: email, mode: "insensitive" } }],
    },
    include: {
      client: {
        include: { contacts: true },
      },
    },
    orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
  });

  if (
    portalUser?.client &&
    portalUser.client.primaryBrokerOrgId === brokerOrgId &&
    portalUser.client.isDeleted !== true
  ) {
    return portalUser.client;
  }

  const byContact = await tx.client.findFirst({
    where: {
      primaryBrokerOrgId: brokerOrgId,
      isDeleted: false,
      contacts: {
        some: {
          OR: [{ email }, { email: { equals: email, mode: "insensitive" } }],
        },
      },
    },
    include: { contacts: true },
    orderBy: { createdAt: "asc" },
  });

  return byContact || null;
}

async function reuseExistingClient(
  tx,
  { client, email, incomingFirst, incomingLast, incomingDisplay, logger },
) {
  const warnings = [];
  let nameMismatch = false;
  let nextClient = client;

  const primaryContact =
    (client.contacts || []).find(
      (contact) => contactMatchesEmail(contact, email) && contact.isPrimary,
    ) ||
    (client.contacts || []).find((contact) => contactMatchesEmail(contact, email)) ||
    (client.contacts || []).find((contact) => contact.isPrimary) ||
    (client.contacts || [])[0] ||
    null;

  const existingContactName = primaryContact
    ? buildDisplayName({
        firstName: primaryContact.firstName,
        lastName: primaryContact.lastName,
      })
    : "";
  const existingLegalName = normalizePersonName(client.legalName);

  if (
    namesDiffer(existingContactName || existingLegalName, incomingDisplay)
  ) {
    nameMismatch = true;
    const warning =
      "Borrower name differs from existing client portal identity; existing identity was kept";
    warnings.push(warning);
    if (logger?.warn) {
      logger.warn(
        {
          clientId: client.id,
          email,
          existingName: existingContactName || existingLegalName,
          submittedName: incomingDisplay,
        },
        "Borrower name mismatch on client reuse",
      );
    }
  }

  // Only fill empty/generic identity — never overwrite a real name.
  if (incomingDisplay && isGenericClientName(client.legalName)) {
    nextClient = await tx.client.update({
      where: { id: client.id },
      data: { legalName: incomingDisplay },
      include: { contacts: true },
    });
  }

  if (primaryContact) {
    const contactUpdates = {};
    if (
      incomingFirst &&
      incomingFirst !== "Applicant" &&
      isGenericClientName(primaryContact.firstName)
    ) {
      contactUpdates.firstName = incomingFirst;
    }
    if (
      incomingLast &&
      isGenericClientName(primaryContact.lastName || "")
    ) {
      contactUpdates.lastName = incomingLast;
    }

    if (Object.keys(contactUpdates).length > 0) {
      await tx.clientContact.update({
        where: { id: primaryContact.id },
        data: contactUpdates,
      });
      nextClient = await tx.client.findUnique({
        where: { id: client.id },
        include: { contacts: true },
      });
    }
  }

  return {
    client: nextClient,
    reused: true,
    nameMismatch,
    warnings,
    email,
  };
}

module.exports = {
  findOrCreateBorrowerClient,
  findExistingBorrowerClient,
  normalizeClientEmail,
  namesDiffer,
  buildDisplayName,
};
