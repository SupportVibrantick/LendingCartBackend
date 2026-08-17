/**
 * Public (no auth) counterpart of /broker/loan-pipeline/:loanId/request-documents.
 *
 * Lets a borrower who just submitted a public embed create document
 * requirements on their freshly created loanApplication so subsequent
 * uploads land under the right documentType.
 *
 * Auth gate: the loan application must have been created by the public
 * submit flow (publicSourcePortal != null).
 *
 * Accepts document-type labels (e.g. "Bank Statements") and resolves them
 * against the global active catalog on the backend — the public frontend
 * has no token to hit /document-types/active itself. If a label has no
 * matching catalog row, we auto-create a new active DocumentType so the
 * requirement can still be created (the seed is optional in this DB).
 */

async function resolveOrCreateTypeByLabel(prisma, label) {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();

  // 1. exact name match (case-insensitive)
  let row = await prisma.documentType.findFirst({
    where: {
      isActive: true,
      name: { equals: trimmed, mode: "insensitive" },
    },
    select: { id: true, name: true },
  });

  // 2. partial match — "Tax Returns" should match a row called
  //    "2 Years Business Tax Returns" (the seed has long names).
  if (!row) {
    const candidates = await prisma.documentType.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
    row =
      candidates.find((d) => {
        const name = d.name.trim().toLowerCase();
        return name.includes(lowered) || lowered.includes(name);
      }) || null;
  }

  // 3. fallback — auto-create a new global DocumentType so the borrower
  //    can attach the file even if the seed hasn't been run or the org
  //    hasn't added custom types.
  if (!row) {
    const slug = trimmed
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "CUSTOM";

    // Generate a unique code if the slug collides
    let code = `PUBLIC_${slug}`;
    let suffix = 1;
    // eslint-disable-next-line no-await-in-loop
    while (
      await prisma.documentType.findFirst({ where: { code }, select: { id: true } })
    ) {
      suffix += 1;
      code = `PUBLIC_${slug}_${suffix}`;
    }

    row = await prisma.documentType.create({
      data: {
        name: trimmed,
        code,
        isActive: true,
        isCustom: false,
        description: `Auto-created from public embed (${trimmed})`,
      },
      select: { id: true, name: true },
    });
  }

  return row;
}

async function requestDocumentsRoute(fastify) {
  fastify.post(
    "/:loanApplicationId/request-documents",
    {
      schema: {
        tags: ["Public Broker Applications"],
        summary:
          "Create / refresh document requirements for a public-embed loan",
        params: {
          type: "object",
          required: ["loanApplicationId"],
          properties: {
            loanApplicationId: { type: "string" },
          },
        },
        body: {
          type: "object",
          // One of `documentTypes` (labels) or `documentTypeIds` (uuids)
          // must be provided. Labels are resolved server-side.
          properties: {
            documentTypes: {
              type: "array",
              items: { type: "string" },
            },
            documentTypeIds: {
              type: "array",
              items: { type: "string", format: "uuid" },
            },
          },
          anyOf: [
            { required: ["documentTypes"] },
            { required: ["documentTypeIds"] },
          ],
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const { loanApplicationId } = req.params;
        const body = req.body || {};
        const labels = Array.isArray(body.documentTypes) ? body.documentTypes : [];
        const incomingIds = Array.isArray(body.documentTypeIds)
          ? body.documentTypeIds
          : [];

        if (labels.length === 0 && incomingIds.length === 0) {
          return reply.code(400).send({
            success: false,
            message: "Please provide at least one document type",
          });
        }

        const loan = await prisma.loanApplication.findFirst({
          where: {
            id: loanApplicationId,
            publicSourcePortal: { not: null },
          },
          select: { id: true, publicSourcePortal: true },
        });

        if (!loan) {
          return reply.code(403).send({
            success: false,
            message:
              "Loan application not found or not eligible for public document upload",
          });
        }

        const nameById = new Map();

        if (incomingIds.length > 0) {
          const catalog = await prisma.documentType.findMany({
            where: { id: { in: incomingIds } },
            select: { id: true, name: true },
          });
          for (const d of catalog) nameById.set(d.id, d.name);
        }

        // Resolve each unique label to a DocumentType id (exact → partial
        // → auto-create). Sequential so the auto-create path can guard
        // against code collisions cleanly.
        const seenLabels = [
          ...new Set(
            labels
              .filter((label) => typeof label === "string" && label.trim())
              .map((label) => label.trim()),
          ),
        ];

        for (const label of seenLabels) {
          // eslint-disable-next-line no-await-in-loop
          const resolved = await resolveOrCreateTypeByLabel(prisma, label);
          if (resolved) {
            nameById.set(resolved.id, resolved.name);
          }
        }

        const typeIds = [...nameById.keys()];

        if (typeIds.length === 0) {
          return reply.code(404).send({
            success: false,
            message:
              "None of the provided document types could be resolved",
          });
        }

        const createdRequirements = [];

        await prisma.$transaction(async (tx) => {
          const existingDocs =
            await tx.applicationDocumentRequirement.findMany({
              where: { loanApplicationId: loan.id },
              select: { id: true, documentTypeId: true },
            });

          for (const docTypeId of typeIds) {
            const existing = existingDocs.find(
              (d) => d.documentTypeId === docTypeId,
            );

            if (existing) {
              const updated = await tx.applicationDocumentRequirement.update({
                where: { id: existing.id },
                data: {
                  status: "PENDING",
                  lastRequestedAt: new Date(),
                },
              });
              createdRequirements.push(updated);
            } else {
              const created =
                await tx.applicationDocumentRequirement.create({
                  data: {
                    loanApplicationId: loan.id,
                    documentTypeId: docTypeId,
                    source: "BROKER_ADDED",
                    isRequired: true,
                    status: "PENDING",
                    lastRequestedAt: new Date(),
                  },
                });
              createdRequirements.push(created);
            }
          }
        });

        return reply.send({
          success: true,
          message: "Document requirements created",
          data: {
            requirements: createdRequirements.map((reqRow) => ({
              requirementId: reqRow.id,
              documentTypeId: reqRow.documentTypeId,
              documentName: nameById.get(reqRow.documentTypeId) || null,
            })),
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            route: "public-request-documents",
          },
          "Public request documents failed",
        );
        return reply.code(500).send({
          success: false,
          message: error.message || "Unexpected server error",
        });
      }
    },
  );
}

module.exports = requestDocumentsRoute;
