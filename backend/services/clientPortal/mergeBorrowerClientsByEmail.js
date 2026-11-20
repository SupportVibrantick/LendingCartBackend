const { normalizeClientEmail } = require("./findOrCreateBorrowerClient");
const { Prisma } = require("@prisma/client");

const EMAIL_FIELD_KEYS = [
  "email",
  "preferredEmail",
  "borrowerEmail",
  "clientEmail",
  "contactEmail",
];

/**
 * Find the Client that already "owns" this portal email (portal user first,
 * then contact), scoped to the broker org when possible.
 */
async function findClientOwningEmail(tx, { brokerOrgId, email }) {
  const normalized = normalizeClientEmail(email);
  if (!normalized) return null;

  const portalUser = await tx.clientPortalUser.findFirst({
    where: {
      isDeleted: { not: true },
      OR: [
        { email: normalized },
        { email: { equals: normalized, mode: "insensitive" } },
      ],
    },
    include: {
      client: {
        select: {
          id: true,
          primaryBrokerOrgId: true,
          isDeleted: true,
          legalName: true,
        },
      },
    },
    orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
  });

  if (
    portalUser?.client &&
    portalUser.client.isDeleted !== true &&
    (!brokerOrgId || portalUser.client.primaryBrokerOrgId === brokerOrgId)
  ) {
    return {
      clientId: portalUser.client.id,
      via: "portal",
      portalUserId: portalUser.id,
    };
  }

  const contact = await tx.clientContact.findFirst({
    where: {
      OR: [
        { email: normalized },
        { email: { equals: normalized, mode: "insensitive" } },
      ],
      client: {
        isDeleted: { not: true },
        ...(brokerOrgId ? { primaryBrokerOrgId: brokerOrgId } : {}),
      },
    },
    select: {
      clientId: true,
      client: { select: { id: true, legalName: true } },
    },
    orderBy: { id: "asc" },
  });

  if (contact?.clientId) {
    return { clientId: contact.clientId, via: "contact", portalUserId: null };
  }

  return null;
}

/**
 * Move all loan apps + related client-scoped rows from absorbed → survivor.
 * Soft-deletes absorbed portal users and the absorbed Client. No app data loss.
 */
async function mergeClientInto(tx, { survivorClientId, absorbedClientId }) {
  if (!survivorClientId || !absorbedClientId) {
    throw new Error("survivorClientId and absorbedClientId are required");
  }
  if (survivorClientId === absorbedClientId) {
    return { merged: false, movedApplications: 0 };
  }

  const movedApps = await tx.loanApplication.updateMany({
    where: { clientId: absorbedClientId },
    data: { clientId: survivorClientId },
  });

  await tx.feeAgreement.updateMany({
    where: { clientId: absorbedClientId },
    data: { clientId: survivorClientId },
  });

  await tx.clientUploadToken.updateMany({
    where: { clientId: absorbedClientId },
    data: { clientId: survivorClientId },
  });

  // Soft-delete portal logins on the absorbed client (email uniqueness stays
  // on the survivor portal user).
  await tx.clientPortalUser.updateMany({
    where: {
      clientId: absorbedClientId,
      isDeleted: { not: true },
    },
    data: {
      isActive: false,
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  await tx.client.update({
    where: { id: absorbedClientId },
    data: {
      isActive: false,
      isDeleted: true,
      deletedAt: new Date(),
    },
  });

  return {
    merged: true,
    movedApplications: movedApps.count || 0,
    survivorClientId,
    absorbedClientId,
  };
}

/**
 * Point every active submission email field on this client's apps to `email`.
 */
async function syncClientApplicationEmails(
  tx,
  { brokerOrgId, clientId, email },
) {
  const normalized = normalizeClientEmail(email);
  if (!normalized || !clientId) return { updated: 0 };

  const result = await tx.applicationSubmissionField.updateMany({
    where: {
      OR: [
        { fieldKey: { in: EMAIL_FIELD_KEYS } },
        { builderField: { fieldKey: { in: EMAIL_FIELD_KEYS } } },
      ],
      submission: {
        status: { not: "SUPERSEDED" },
        application: {
          clientId,
          ...(brokerOrgId ? { brokerOrgId } : {}),
        },
      },
    },
    data: { value: normalized },
  });

  return { updated: result.count || 0 };
}

const FIRST_NAME_FIELD_KEYS = [
  "borrowerFirstName",
  "first_name",
  "firstName",
];
const LAST_NAME_FIELD_KEYS = [
  "borrowerLastName",
  "last_name",
  "lastName",
];
const FULL_NAME_FIELD_KEYS = [
  "borrowerName",
  "applicantName",
  "fullName",
  "name",
];

/**
 * After merge, align primary borrower name fields on all apps under this
 * portal Client with the portal identity (contact / legalName).
 */
async function syncClientApplicationBorrowerNames(
  tx,
  { brokerOrgId, clientId, firstName, lastName, fullName },
) {
  if (!clientId) return { updated: 0 };
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  const full =
    String(fullName || "").trim() ||
    `${first} ${last}`.trim();

  if (!first && !full) return { updated: 0 };

  let updated = 0;
  const appFilter = {
    status: { not: "SUPERSEDED" },
    application: {
      clientId,
      ...(brokerOrgId ? { brokerOrgId } : {}),
    },
  };

  if (first) {
    const r = await tx.applicationSubmissionField.updateMany({
      where: {
        OR: [
          { fieldKey: { in: FIRST_NAME_FIELD_KEYS } },
          { builderField: { fieldKey: { in: FIRST_NAME_FIELD_KEYS } } },
        ],
        submission: appFilter,
      },
      data: { value: first },
    });
    updated += r.count || 0;
  }

  if (last || first) {
    const r = await tx.applicationSubmissionField.updateMany({
      where: {
        OR: [
          { fieldKey: { in: LAST_NAME_FIELD_KEYS } },
          { builderField: { fieldKey: { in: LAST_NAME_FIELD_KEYS } } },
        ],
        submission: appFilter,
      },
      data: { value: last || "" },
    });
    updated += r.count || 0;
  }

  if (full) {
    const r = await tx.applicationSubmissionField.updateMany({
      where: {
        OR: [
          { fieldKey: { in: FULL_NAME_FIELD_KEYS } },
          { builderField: { fieldKey: { in: FULL_NAME_FIELD_KEYS } } },
        ],
        submission: appFilter,
      },
      data: { value: full },
    });
    updated += r.count || 0;
  }

  return { updated };
}

/**
 * Reassign other broker-org applications whose active form email already
 * equals this portal email onto the survivor client (one email → one portal).
 */
async function reconcileAppsWithEmailToClient(
  tx,
  { brokerOrgId, survivorClientId, email },
) {
  const normalized = normalizeClientEmail(email);
  if (!normalized || !survivorClientId || !brokerOrgId) {
    return { reassigned: 0, absorbedClientIds: [] };
  }

  // Json string values are stored as JSON strings; match both raw and quoted.
  const rows = await tx.$queryRaw`
    SELECT DISTINCT la.id AS "applicationId", la."clientId"
    FROM loan_applications la
    INNER JOIN application_submissions s ON s."applicationId" = la.id
    INNER JOIN application_submission_fields f ON f."submissionId" = s.id
    LEFT JOIN broker_application_product_fields bf ON bf.id = f."fieldId"
    WHERE la."brokerOrgId" = ${brokerOrgId}::uuid
      AND la."clientId" IS NOT NULL
      AND la."clientId" <> ${survivorClientId}::uuid
      AND s.status <> 'SUPERSEDED'
      AND (
        f."fieldKey" IN (${Prisma.join(EMAIL_FIELD_KEYS)})
        OR bf."fieldKey" IN (${Prisma.join(EMAIL_FIELD_KEYS)})
      )
      AND (
        LOWER(CASE
          WHEN jsonb_typeof(f.value) = 'string' THEN f.value #>> '{}'
          ELSE f.value::text
        END) = ${normalized}
      )
  `;

  const absorbedIds = new Set();
  for (const row of rows || []) {
    if (row.clientId) absorbedIds.add(row.clientId);
  }

  let reassigned = 0;
  for (const absorbedClientId of absorbedIds) {
    const result = await mergeClientInto(tx, {
      survivorClientId,
      absorbedClientId,
    });
    reassigned += result.movedApplications || 0;
  }

  return {
    reassigned,
    absorbedClientIds: [...absorbedIds],
  };
}

/**
 * Ensure survivor has primary contact + active portal login for `email`.
 * Does not create a portal user (needs password) — only updates existing /
 * soft-reactivates matching portal user on survivor if present.
 */
async function ensureSurvivorEmailIdentity(
  tx,
  { survivorClientId, email, previousEmail },
) {
  const normalized = normalizeClientEmail(email);
  const normalizedPrevious = normalizeClientEmail(previousEmail);
  if (!survivorClientId || !normalized) return;

  const contacts = await tx.clientContact.findMany({
    where: { clientId: survivorClientId },
    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
  });

  const matching =
    contacts.filter((c) => {
      const e = normalizeClientEmail(c.email);
      return e === normalized || (normalizedPrevious && e === normalizedPrevious);
    }) || [];
  const toUpdate =
    matching.length > 0
      ? matching
      : contacts[0]
        ? [contacts[0]]
        : [];

  for (const contact of toUpdate) {
    await tx.clientContact.update({
      where: { id: contact.id },
      data: { email: normalized },
    });
  }

  if (toUpdate.length === 0) {
    const client = await tx.client.findUnique({
      where: { id: survivorClientId },
      select: { legalName: true },
    });
    await tx.clientContact.create({
      data: {
        clientId: survivorClientId,
        firstName: client?.legalName?.split(/\s+/)[0] || "Applicant",
        lastName: null,
        email: normalized,
        isPrimary: true,
      },
    });
  }

  // Soft-delete other portal users on survivor that used previous email.
  const portalUsers = await tx.clientPortalUser.findMany({
    where: { clientId: survivorClientId, isDeleted: { not: true } },
  });

  let keeper =
    portalUsers.find((u) => normalizeClientEmail(u.email) === normalized) ||
    portalUsers.find(
      (u) =>
        normalizedPrevious &&
        normalizeClientEmail(u.email) === normalizedPrevious,
    ) ||
    portalUsers.find((u) => u.isActive !== false) ||
    portalUsers[0] ||
    null;

  for (const user of portalUsers) {
    if (keeper && user.id === keeper.id) continue;
    const e = normalizeClientEmail(user.email);
    if (
      e === normalized ||
      (normalizedPrevious && e === normalizedPrevious)
    ) {
      await tx.clientPortalUser.update({
        where: { id: user.id },
        data: {
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    }
  }

  if (keeper) {
    // Only rewrite email when it won't collide with another row's unique email.
    const emailTakenElsewhere = await tx.clientPortalUser.findFirst({
      where: {
        id: { not: keeper.id },
        isDeleted: { not: true },
        OR: [
          { email: normalized },
          { email: { equals: normalized, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (!emailTakenElsewhere) {
      await tx.clientPortalUser.update({
        where: { id: keeper.id },
        data: {
          email: normalized,
          isActive: true,
          isDeleted: false,
          deletedAt: null,
        },
      });
    } else {
      // Survivor should already own `normalized` via the other row — soft-delete keeper if duplicate.
      if (normalizeClientEmail(keeper.email) !== normalized) {
        await tx.clientPortalUser.update({
          where: { id: keeper.id },
          data: {
            isActive: false,
            isDeleted: true,
            deletedAt: new Date(),
          },
        });
      }
    }

    await tx.clientPortalPasswordResetToken.updateMany({
      where: { userId: keeper.id, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}

module.exports = {
  EMAIL_FIELD_KEYS,
  findClientOwningEmail,
  mergeClientInto,
  syncClientApplicationEmails,
  syncClientApplicationBorrowerNames,
  reconcileAppsWithEmailToClient,
  ensureSurvivorEmailIdentity,
};
