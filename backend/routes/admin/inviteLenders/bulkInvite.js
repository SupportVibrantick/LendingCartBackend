const { adminLogs } = require("../../../services/logger/contextLogger.js");
const {
  normalizeInviteRow,
  validateInviteRowShape,
  createAdminLenderInviteAndEnqueue,
} = require("../../../services/lenderInvites/createAdminLenderInvite");

const MAX_BULK_ROWS = 500;

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function bulkInviteLenderRoutes(fastify) {
  fastify.post(
    "/bulk",
    {
      schema: {
        tags: ["Admin -> Invite Lenders"],
        summary: "Bulk invite lenders and enqueue invitation emails",
        body: {
          type: "object",
          required: ["rows"],
          properties: {
            rows: {
              type: "array",
              maxItems: MAX_BULK_ROWS,
              items: {
                type: "object",
                required: ["companyName", "fullName", "email", "phone"],
                properties: {
                  companyName: { type: "string" },
                  fullName: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                },
              },
            },
            skipInvalid: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const rawRows = Array.isArray(request.body?.rows) ? request.body.rows : [];
      const skipInvalid = request.body?.skipInvalid !== false;
      const invitedByAdminId = request.user?.id || null;

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
        const created = [];
        const failed = [];

        for (let i = 0; i < rawRows.length; i += 1) {
          const rowNumber = i + 1;
          const normalized = normalizeInviteRow(rawRows[i]);
          const shapeErrors = validateInviteRowShape(normalized);

          if (normalized.email && seenEmails.has(normalized.email)) {
            shapeErrors.push("Duplicate email in this upload");
          }
          if (normalized.email) seenEmails.add(normalized.email);

          if (shapeErrors.length) {
            failed.push({
              rowNumber,
              email: normalized.email || null,
              errors: shapeErrors,
            });
            if (!skipInvalid) {
              return reply.status(400).send({
                success: false,
                message: `Row ${rowNumber} is invalid: ${shapeErrors.join("; ")}`,
                data: { failed, created },
              });
            }
            continue;
          }

          try {
            const invite = await createAdminLenderInviteAndEnqueue(prisma, {
              ...normalized,
              invitedByAdminId,
            });
            created.push({
              rowNumber,
              ...invite,
            });
          } catch (error) {
            failed.push({
              rowNumber,
              email: normalized.email,
              errors: [error.message || "Failed to invite"],
            });
            if (!skipInvalid && error.code !== "CONFLICT") {
              return reply.status(500).send({
                success: false,
                message: `Stopped at row ${rowNumber}: ${error.message}`,
                data: { failed, created },
              });
            }
          }
        }

        adminLogs.info("Bulk lender invitations processed", {
          total: rawRows.length,
          created: created.length,
          failed: failed.length,
          invitedByAdminId,
        });

        return reply.send({
          success: true,
          message: `Queued ${created.length} invitation email(s). ${failed.length} row(s) skipped.`,
          data: {
            total: rawRows.length,
            createdCount: created.length,
            failedCount: failed.length,
            created,
            failed,
          },
        });
      } catch (error) {
        adminLogs.error("Bulk lender invitation failed", error);
        return reply.status(500).send({
          success: false,
          message: "Failed to process bulk invitations",
        });
      }
    },
  );
}

module.exports = bulkInviteLenderRoutes;
