const {
  normalizeClientEmail,
} = require("./findOrCreateBorrowerClient");
const {
  findClientOwningEmail,
  mergeClientInto,
  syncClientApplicationEmails,
  syncClientApplicationBorrowerNames,
  reconcileAppsWithEmailToClient,
  ensureSurvivorEmailIdentity,
} = require("./mergeBorrowerClientsByEmail");

/**
 * Active portal login email for a client (source of truth for access links).
 */
async function resolveActivePortalLoginEmail(prisma, clientId) {
  if (!clientId) return null;
  const user = await prisma.clientPortalUser.findFirst({
    where: {
      clientId,
      isDeleted: { not: true },
      isActive: true,
    },
    orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
    select: { email: true },
  });
  return normalizeClientEmail(user?.email) || null;
}

/**
 * Preflight for portal email change. Conflict with another portal is OK —
 * changeBorrowerPortalEmail merges into that portal (one email → one portal).
 */
async function assertBorrowerPortalEmailAvailable(
  prisma,
  { brokerOrgId, loanApplicationId, newEmail, previousEmail },
) {
  const normalizedNew = normalizeClientEmail(newEmail);
  const normalizedPrevious = normalizeClientEmail(previousEmail);

  if (!normalizedNew) {
    const err = new Error("New email is required");
    err.statusCode = 400;
    throw err;
  }
  if (!brokerOrgId || !loanApplicationId) {
    const err = new Error("Application not found");
    err.statusCode = 404;
    throw err;
  }

  const application = await prisma.loanApplication.findFirst({
    where: {
      id: loanApplicationId,
      brokerOrgId,
    },
    select: {
      id: true,
      clientId: true,
      client: { select: { id: true } },
    },
  });

  if (!application?.client) {
    const err = new Error("Application client not found");
    err.statusCode = 404;
    throw err;
  }

  if (normalizedPrevious && normalizedPrevious === normalizedNew) {
    return {
      ok: true,
      unchanged: true,
      email: normalizedNew,
      clientId: application.client.id,
      needsMerge: false,
      targetClientId: null,
    };
  }

  const owner = await findClientOwningEmail(prisma, {
    brokerOrgId,
    email: normalizedNew,
  });

  const needsMerge = Boolean(
    owner?.clientId && owner.clientId !== application.client.id,
  );

  return {
    ok: true,
    unchanged: false,
    email: normalizedNew,
    clientId: application.client.id,
    needsMerge,
    targetClientId: needsMerge ? owner.clientId : null,
  };
}

/**
 * Change portal login email for this application's client.
 * If the new email already has a portal/client, merge this client into that
 * one so there is a single portal per email — applications move, no data loss.
 */
async function changeBorrowerPortalEmail(
  prisma,
  {
    brokerOrgId,
    loanApplicationId,
    newEmail,
    previousEmail,
  },
) {
  const normalizedNew = normalizeClientEmail(newEmail);
  const normalizedPrevious = normalizeClientEmail(previousEmail);

  const preflight = await assertBorrowerPortalEmailAvailable(prisma, {
    brokerOrgId,
    loanApplicationId,
    newEmail,
    previousEmail,
  });

  const application = await prisma.loanApplication.findFirst({
    where: {
      id: loanApplicationId,
      brokerOrgId,
    },
    select: {
      id: true,
      clientId: true,
    },
  });

  if (!application?.clientId) {
    const err = new Error("Application client not found");
    err.statusCode = 404;
    throw err;
  }

  const sourceClientId = application.clientId;

  const result = await prisma.$transaction(async (tx) => {
    let survivorClientId = sourceClientId;
    let merged = false;
    let movedApplications = 0;
    let absorbedClientIds = [];

    // Prefer existing portal owner for this email as the single survivor.
    const owner = await findClientOwningEmail(tx, {
      brokerOrgId,
      email: normalizedNew,
    });

    if (owner?.clientId && owner.clientId !== sourceClientId) {
      const mergeResult = await mergeClientInto(tx, {
        survivorClientId: owner.clientId,
        absorbedClientId: sourceClientId,
      });
      survivorClientId = owner.clientId;
      merged = true;
      movedApplications += mergeResult.movedApplications || 0;
      absorbedClientIds.push(sourceClientId);
    }

    await ensureSurvivorEmailIdentity(tx, {
      survivorClientId,
      email: normalizedNew,
      previousEmail: normalizedPrevious,
    });

    // Pull in any other apps in this broker org that already use this email
    // on the form but sit on a different Client (desynced / duplicate portals).
    const reconcile = await reconcileAppsWithEmailToClient(tx, {
      brokerOrgId,
      survivorClientId,
      email: normalizedNew,
    });
    if (reconcile.reassigned > 0) {
      merged = true;
      movedApplications += reconcile.reassigned;
      absorbedClientIds.push(...(reconcile.absorbedClientIds || []));
    }

    await syncClientApplicationEmails(tx, {
      brokerOrgId,
      clientId: survivorClientId,
      email: normalizedNew,
    });

    // Keep pipeline / form borrower names aligned with portal identity after
    // merge (e.g. absorbed app still said "Jqne amirh" while portal is Tushar).
    if (merged) {
      const survivor = await tx.client.findUnique({
        where: { id: survivorClientId },
        select: {
          legalName: true,
          contacts: {
            orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
            take: 1,
            select: { firstName: true, lastName: true },
          },
        },
      });
      const contact = survivor?.contacts?.[0];
      const firstName =
        contact?.firstName ||
        survivor?.legalName?.trim()?.split(/\s+/)[0] ||
        "";
      const lastName =
        contact?.lastName ||
        survivor?.legalName?.trim()?.split(/\s+/).slice(1).join(" ") ||
        "";
      await syncClientApplicationBorrowerNames(tx, {
        brokerOrgId,
        clientId: survivorClientId,
        firstName,
        lastName,
        fullName: survivor?.legalName || undefined,
      });
    }

    return {
      changed: !preflight.unchanged || merged,
      reason: merged
        ? "merged"
        : preflight.unchanged
          ? "unchanged"
          : "updated",
      clientId: survivorClientId,
      previousEmail: normalizedPrevious || null,
      email: normalizedNew,
      merged,
      movedApplications,
      absorbedClientIds: [...new Set(absorbedClientIds)],
      portalUserUpdated: true,
    };
  });

  return result;
}

module.exports = {
  normalizeClientEmail,
  resolveActivePortalLoginEmail,
  assertBorrowerPortalEmailAvailable,
  changeBorrowerPortalEmail,
};
