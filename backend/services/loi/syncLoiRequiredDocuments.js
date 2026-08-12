const {
  resolveLenderRequestSentToClientAt,
} = require("../documents/documentAutoForwardSetting");

const PRESERVE_SOURCES_ON_BROKER_SYNC = new Set([
  "LENDER_ADDED",
  "LENDER_DEFAULT",
  "PRODUCT_DEFAULT",
  "SUB_BROKER_ADDED",
]);

function normalizeDocumentNames(documentNames = []) {
  return [
    ...new Set(
      (Array.isArray(documentNames) ? documentNames : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  ];
}

function normalizeDocumentNameKey(name) {
  return String(name || "").trim().toLowerCase();
}

function extractStoredBrokerLoiDocumentNames(storedTerms) {
  if (!storedTerms || typeof storedTerms !== "object") {
    return [];
  }

  if (Array.isArray(storedTerms.requiredDocuments)) {
    return normalizeDocumentNames(storedTerms.requiredDocuments);
  }

  if (Array.isArray(storedTerms.closingConditions)) {
    return normalizeDocumentNames(storedTerms.closingConditions);
  }

  return [];
}

/**
 * Resolve document type IDs by name for a broker/lender org.
 * Only platform (non-custom) types and this org's custom types are eligible —
 * never another organization's custom documents.
 */
async function findDocumentTypeIdsByNames(tx, names = [], { orgId } = {}) {
  const normalized = normalizeDocumentNames(names);
  if (!normalized.length) {
    return [];
  }

  const nameFilters = normalized.map((name) => ({
    name: { equals: name, mode: "insensitive" },
  }));

  const documentTypes = await tx.documentType.findMany({
    where: {
      isActive: true,
      OR: [
        {
          isCustom: false,
          OR: nameFilters,
        },
        ...(orgId
          ? [
              {
                isCustom: true,
                createdByOrgId: orgId,
                OR: nameFilters,
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      name: true,
      isCustom: true,
      createdByOrgId: true,
    },
  });

  // Prefer this org's custom type over a platform type with the same name.
  const byKey = new Map();
  for (const row of documentTypes) {
    const key = normalizeDocumentNameKey(row.name);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const rowIsOwnCustom =
      row.isCustom && orgId && row.createdByOrgId === orgId;
    const existingIsOwnCustom =
      existing.isCustom && orgId && existing.createdByOrgId === orgId;
    if (rowIsOwnCustom && !existingIsOwnCustom) {
      byKey.set(key, row);
    }
  }

  return normalized
    .map((name) => byKey.get(normalizeDocumentNameKey(name))?.id)
    .filter(Boolean);
}

async function pruneRemovedBrokerLoiDocuments(
  tx,
  {
    loanApplicationId,
    previousDocumentNames = [],
    currentDocumentNames = [],
    excludeDocumentTypeIds = [],
    orgId = null,
  },
) {
  const previous = normalizeDocumentNames(previousDocumentNames);
  const currentKeys = new Set(
    normalizeDocumentNames(currentDocumentNames).map(normalizeDocumentNameKey),
  );
  const removedNames = previous.filter(
    (name) => !currentKeys.has(normalizeDocumentNameKey(name)),
  );

  if (!removedNames.length) {
    return { pruned: 0, clearedFromClient: 0 };
  }

  const removedDocumentTypeIds = await findDocumentTypeIdsByNames(
    tx,
    removedNames,
    { orgId },
  );
  const excluded = new Set(excludeDocumentTypeIds.filter(Boolean));

  const removableTypeIds = removedDocumentTypeIds.filter(
    (id) => !excluded.has(id),
  );

  if (!removableTypeIds.length) {
    return { pruned: 0, clearedFromClient: 0 };
  }

  const requirements = await tx.applicationDocumentRequirement.findMany({
    where: {
      loanApplicationId,
      documentTypeId: { in: removableTypeIds },
      requiresClientSignature: false,
      source: { in: ["BROKER_ADDED", "LENDER_ADDED"] },
    },
    include: {
      uploads: { select: { id: true }, take: 1 },
    },
  });

  let pruned = 0;
  let clearedFromClient = 0;

  for (const requirement of requirements) {
    if (requirement.source === "LENDER_ADDED") {
      if (requirement.sentToClientAt) {
        await tx.applicationDocumentRequirement.update({
          where: { id: requirement.id },
          data: {
            sentToClientAt: null,
            updatedAt: new Date(),
          },
        });
        clearedFromClient += 1;
      }
      continue;
    }

    if (requirement.uploads?.length) {
      if (requirement.sentToClientAt) {
        await tx.applicationDocumentRequirement.update({
          where: { id: requirement.id },
          data: {
            sentToClientAt: null,
            updatedAt: new Date(),
          },
        });
        clearedFromClient += 1;
      }
      continue;
    }

    await tx.applicationDocumentRequirement.delete({
      where: { id: requirement.id },
    });
    pruned += 1;
  }

  return { pruned, clearedFromClient };
}

/**
 * Map a required-document name to a DocumentType id.
 * Custom types are always org-scoped: Broker A never reuses Broker B's custom type.
 */
async function resolveDocumentTypeIdByName(tx, { name, orgId }) {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    throw new Error("Document name is required");
  }
  if (!orgId) {
    throw new Error("Organization is required to resolve custom documents");
  }

  const orgCustom = await tx.documentType.findFirst({
    where: {
      isActive: true,
      isCustom: true,
      createdByOrgId: orgId,
      name: {
        equals: trimmed,
        mode: "insensitive",
      },
    },
  });

  if (orgCustom) {
    return orgCustom.id;
  }

  // Shared platform catalog only — never another org's custom document.
  const platform = await tx.documentType.findFirst({
    where: {
      isActive: true,
      isCustom: false,
      name: {
        equals: trimmed,
        mode: "insensitive",
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (platform) {
    return platform.id;
  }

  const created = await tx.documentType.create({
    data: {
      name: trimmed,
      isCustom: true,
      createdByOrgId: orgId,
      isActive: true,
      code: `LOI_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    },
  });

  return created.id;
}

/**
 * Create or refresh application document requirements from LOI / term sheet
 * required document names. Also creates org custom document types when needed.
 */
async function syncLoiRequiredDocuments(
  prisma,
  {
    loanApplicationId,
    applicationLenderId = null,
    documentNames = [],
    actor,
    orgId,
    previousDocumentNames = [],
    replaceBrokerLoiSet = false,
    excludeDocumentTypeIds = [],
  },
) {
  const names = normalizeDocumentNames(documentNames);
  if (!names.length || !loanApplicationId || !orgId) {
    return { synced: 0, documentTypeIds: [], pruned: 0 };
  }

  if (!["LENDER", "BROKER"].includes(actor)) {
    throw new Error("Invalid LOI document sync actor");
  }

  const source = actor === "LENDER" ? "LENDER_ADDED" : "BROKER_ADDED";
  const sentToClientAt =
    actor === "LENDER"
      ? await resolveLenderRequestSentToClientAt(prisma, loanApplicationId)
      : null;

  return prisma.$transaction(async (tx) => {
    const existingRequirements = await tx.applicationDocumentRequirement.findMany(
      {
        where: { loanApplicationId },
        select: {
          id: true,
          documentTypeId: true,
          source: true,
          requestApplicationLenderId: true,
        },
      },
    );

    const existingMap = new Map(
      existingRequirements.map((row) => [row.documentTypeId, row]),
    );
    const documentTypeIds = [];

    for (const name of names) {
      const documentTypeId = await resolveDocumentTypeIdByName(tx, {
        name,
        orgId,
      });

      documentTypeIds.push(documentTypeId);

      const existing = existingMap.get(documentTypeId);

      if (existing && actor === "BROKER" && applicationLenderId) {
        const lenderRequest = await tx.lenderDocumentRequest.findUnique({
          where: {
            applicationLenderId_documentTypeId: {
              applicationLenderId,
              documentTypeId,
            },
          },
          select: { id: true },
        });

        if (lenderRequest) {
          await tx.applicationDocumentRequirement.update({
            where: { id: existing.id },
            data: {
              source: "LENDER_ADDED",
              requestApplicationLenderId: applicationLenderId,
              lastRequestedAt: new Date(),
              updatedAt: new Date(),
            },
          });
          continue;
        }
      }

      if (
        existing &&
        actor === "BROKER" &&
        PRESERVE_SOURCES_ON_BROKER_SYNC.has(existing.source)
      ) {
        await tx.applicationDocumentRequirement.update({
          where: { id: existing.id },
          data: {
            lastRequestedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        continue;
      }

      const requirementData = {
        status: "PENDING",
        lastRequestedAt: new Date(),
        updatedAt: new Date(),
        source,
        isRequired: true,
        ...(sentToClientAt ? { sentToClientAt } : {}),
        ...(applicationLenderId && actor === "LENDER"
          ? { requestApplicationLenderId: applicationLenderId }
          : {}),
      };

      if (existing) {
        await tx.applicationDocumentRequirement.update({
          where: { id: existing.id },
          data: requirementData,
        });
      } else {
        await tx.applicationDocumentRequirement.create({
          data: {
            loanApplicationId,
            documentTypeId,
            ...requirementData,
          },
        });
      }

      if (actor === "LENDER" && applicationLenderId) {
        await tx.lenderDocumentRequest.upsert({
          where: {
            applicationLenderId_documentTypeId: {
              applicationLenderId,
              documentTypeId,
            },
          },
          update: {
            status: "PENDING",
            updatedAt: new Date(),
          },
          create: {
            loanApplicationId,
            applicationLenderId,
            documentTypeId,
            status: "PENDING",
          },
        });
      }
    }

    let pruneResult = { pruned: 0, clearedFromClient: 0 };
    if (actor === "BROKER" && replaceBrokerLoiSet) {
      pruneResult = await pruneRemovedBrokerLoiDocuments(tx, {
        loanApplicationId,
        previousDocumentNames,
        currentDocumentNames: names,
        excludeDocumentTypeIds,
        orgId,
      });
    }

    return {
      synced: documentTypeIds.length,
      documentTypeIds,
      ...pruneResult,
    };
  });
}

/**
 * Mark broker LOI required documents as sent to the client portal.
 * Only documents listed on the current broker LOI / term sheet are forwarded.
 */
async function forwardBrokerLoiRequiredDocumentsToClient(
  prisma,
  {
    loanApplicationId,
    documentNames = [],
    orgId,
    excludeDocumentTypeIds = [],
  },
) {
  const names = normalizeDocumentNames(documentNames);
  if (!names.length || !loanApplicationId || !orgId) {
    return { forwardedCount: 0, requirementIds: [] };
  }

  return prisma.$transaction(async (tx) => {
    for (const name of names) {
      await resolveDocumentTypeIdByName(tx, { name, orgId });
    }

    const resolvedTypeIds = await findDocumentTypeIdsByNames(tx, names, {
      orgId,
    });
    const excluded = new Set(excludeDocumentTypeIds.filter(Boolean));
    const targetTypeIds = resolvedTypeIds.filter((id) => !excluded.has(id));

    if (!targetTypeIds.length) {
      return { forwardedCount: 0, newlyForwardedCount: 0, requirementIds: [] };
    }

    const requirements = await tx.applicationDocumentRequirement.findMany({
      where: {
        loanApplicationId,
        documentTypeId: { in: targetTypeIds },
        requiresClientSignature: false,
      },
      select: {
        id: true,
        sentToClientAt: true,
        documentTypeId: true,
      },
    });

    const missingTypeIds = targetTypeIds.filter(
      (typeId) =>
        !requirements.some((requirement) => requirement.documentTypeId === typeId),
    );

    const now = new Date();

    for (const documentTypeId of missingTypeIds) {
      await tx.applicationDocumentRequirement.create({
        data: {
          loanApplicationId,
          documentTypeId,
          source: "BROKER_ADDED",
          isRequired: true,
          status: "PENDING",
          lastRequestedAt: now,
          sentToClientAt: now,
        },
      });
    }

    const refreshedRequirements = await tx.applicationDocumentRequirement.findMany({
      where: {
        loanApplicationId,
        documentTypeId: { in: targetTypeIds },
        requiresClientSignature: false,
      },
      select: {
        id: true,
        sentToClientAt: true,
      },
    });

    const toForward = refreshedRequirements.filter(
      (requirement) => !requirement.sentToClientAt,
    );

    if (toForward.length > 0) {
      await tx.applicationDocumentRequirement.updateMany({
        where: { id: { in: toForward.map((requirement) => requirement.id) } },
        data: {
          sentToClientAt: now,
          updatedAt: now,
        },
      });
    }

    return {
      forwardedCount: refreshedRequirements.length,
      newlyForwardedCount: toForward.length,
      requirementIds: refreshedRequirements.map((requirement) => requirement.id),
    };
  });
}

module.exports = {
  normalizeDocumentNames,
  extractStoredBrokerLoiDocumentNames,
  syncLoiRequiredDocuments,
  forwardBrokerLoiRequiredDocumentsToClient,
};
