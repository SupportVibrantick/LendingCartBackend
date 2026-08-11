/**
 * GET /broker/applications/:id/available-document-types
 *
 * Returns the DocumentType rows the broker pre-selected during the loan
 * application wizard (Step 6), so the upload-time dropdown / Loan Preview
 * "Request Documents" panel can show only those categories.
 *
 * Response shapes:
 *
 *   When requestedDocumentTypes is set on the loan:
 *     { success: true, data: { fallback: false, labels: string[], types: { id, code, name, description }[] } }
 *
 *   When requestedDocumentTypes is null (legacy loan created before the
 *   wizard captured selection), returns the full active catalog so legacy
 *   UIs don't break:
 *     { success: true, data: { fallback: true, types: { id, code, name, description }[] } }
 */
async function availableDocumentTypesRoute(fastify) {
  fastify.get(
    "/:id/available-document-types",
    {
      schema: {
        tags: ["Broker -> Applications"],
        summary:
          "Get the document types available for a loan application — scoped to the broker's wizard selection, with a fallback to all active types for legacy loans.",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      const { id } = req.params;

      if (!req.user || !req.user.organizationId) {
        return reply.code(403).send({
          success: false,
          message: "Unauthorized",
        });
      }

      const orgId = req.user.organizationId;

      const loan = await prisma.loanApplication.findFirst({
        where: {
          id,
          brokerOrgId: orgId,
        },
        select: {
          id: true,
          requestedDocumentTypes: true,
        },
      });

      if (!loan) {
        return reply.code(404).send({
          success: false,
          message: "Loan application not found",
        });
      }

      // Legacy loans: no persisted selection. Mirror today's behavior so
      // existing UIs continue to render the full active catalog.
      const selection = loan.requestedDocumentTypes;
      if (!selection || typeof selection !== "object") {
        const fallback = await prisma.documentType.findMany({
          where: { isActive: true, isCustom: false },
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
          },
          orderBy: [{ name: "asc" }],
        });
        return {
          success: true,
          data: {
            fallback: true,
            types: fallback,
          },
        };
      }

      const typeIds = Array.isArray(selection.typeIds) ? selection.typeIds : [];
      const labels = Array.isArray(selection.labels) ? selection.labels : [];

      if (typeIds.length === 0) {
        // Broker selected labels but none resolved to DB rows (e.g. seed
        // hasn't run yet). Return an empty filtered list — frontend should
        // prompt the broker to pick again rather than silently fall back.
        return {
          success: true,
          data: {
            fallback: false,
            labels,
            types: [],
          },
        };
      }

      const types = await prisma.documentType.findMany({
        where: {
          id: { in: typeIds },
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
        },
        // Preserve selection order so the UI renders in the order the
        // broker checked them.
        orderBy: [{ name: "asc" }],
      });

      return {
        success: true,
        data: {
          fallback: false,
          labels,
          types,
        },
      };
    },
  );
}

module.exports = availableDocumentTypesRoute;