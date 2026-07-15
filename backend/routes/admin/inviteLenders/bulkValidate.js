const {
  normalizeInviteRow,
  validateInviteRowShape,
  checkInviteRowConflicts,
} = require("../../../services/lenderInvites/createAdminLenderInvite");

const MAX_BULK_ROWS = 500;

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function bulkValidateLenderInvitesRoutes(fastify) {
  fastify.post(
    "/bulk/validate",
    {
      schema: {
        tags: ["Admin -> Invite Lenders"],
        summary: "Validate bulk lender invitation rows",
        body: {
          type: "object",
          required: ["rows"],
          properties: {
            rows: {
              type: "array",
              maxItems: MAX_BULK_ROWS,
              items: {
                type: "object",
                properties: {
                  companyName: { type: "string" },
                  fullName: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const rawRows = Array.isArray(request.body?.rows) ? request.body.rows : [];

      if (!rawRows.length) {
        return reply.status(400).send({
          success: false,
          message: "No rows provided",
        });
      }

      if (rawRows.length > MAX_BULK_ROWS) {
        return reply.status(400).send({
          success: false,
          message: `Maximum ${MAX_BULK_ROWS} rows allowed per bulk invite`,
        });
      }

      try {
        const seenEmails = new Set();
        const results = [];

        for (let i = 0; i < rawRows.length; i += 1) {
          const normalized = normalizeInviteRow(rawRows[i]);
          const errors = validateInviteRowShape(normalized);

          if (normalized.email) {
            if (seenEmails.has(normalized.email)) {
              errors.push("Duplicate email in this CSV upload");
            } else {
              seenEmails.add(normalized.email);
            }
          }

          if (!errors.length) {
            const conflictErrors = await checkInviteRowConflicts(
              prisma,
              normalized,
            );
            errors.push(...conflictErrors);
          }

          results.push({
            rowNumber: i + 1,
            ...normalized,
            valid: errors.length === 0,
            errors,
          });
        }

        const validRows = results.filter((row) => row.valid);
        const invalidRows = results.filter((row) => !row.valid);

        return reply.send({
          success: true,
          data: {
            total: results.length,
            validCount: validRows.length,
            invalidCount: invalidRows.length,
            rows: results,
          },
        });
      } catch (error) {
        request.log.error(error, "Bulk invite validate failed");
        return reply.status(500).send({
          success: false,
          message: "Failed to validate bulk invitations",
        });
      }
    },
  );
}

module.exports = bulkValidateLenderInvitesRoutes;
