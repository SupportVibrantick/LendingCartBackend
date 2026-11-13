// routes/admin/lenders/softDelete.js
const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  softDeleteLenderOrg,
  softDeleteLendersBulk,
} = require("../../../services/lenders/softDeleteLender");

const MAX_BULK = 50;

/**
 * Soft-delete a lender org (recommended for Admin Portal).
 * Hides from active lender lists (isDeleted), deactivates access/products, disables users.
 * Data stays in DB and can be restored via POST /admin/lenders/restore/:id.
 */
async function softDeleteLenderRoutes(fastify) {
  // Bulk first so "/bulk" is not captured by "/:lenderOrgId"
  fastify.post(
    "/bulk",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "Soft-delete multiple lenders (bulk)",
        body: {
          type: "object",
          required: ["ids"],
          properties: {
            ids: {
              type: "array",
              minItems: 1,
              maxItems: MAX_BULK,
              items: { type: "string", format: "uuid" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const actor = request.user || {};
      const ids = request.body?.ids;

      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({
          success: false,
          message: "ids is required and must be a non-empty array",
        });
      }

      if (ids.length > MAX_BULK) {
        return reply.status(400).send({
          success: false,
          message: `You can delete at most ${MAX_BULK} lenders at once.`,
        });
      }

      try {
        const result = await softDeleteLendersBulk(prisma, ids, actor);

        adminLogs.info("Lenders bulk soft-deleted", {
          requested: result.requested,
          deletedCount: result.deleted.length,
          failedCount: result.failed.length,
          actor: actor.userId ?? actor,
        });

        if (result.deleted.length === 0) {
          return reply.status(404).send({
            success: false,
            message: "No lenders were deleted. They may already be deleted.",
            data: result,
          });
        }

        return reply.send({
          success: true,
          message: `${result.deleted.length} lender${
            result.deleted.length === 1 ? "" : "s"
          } deleted. Data is kept for ${result.retentionDays} days.`,
          data: result,
        });
      } catch (error) {
        adminLogs.error("Bulk soft delete lenders failed", { error, ids });
        return reply.status(500).send({
          success: false,
          message: error?.message || "Could not delete lenders.",
        });
      }
    },
  );

  fastify.delete(
    "/:lenderOrgId",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "Soft-delete a lender — data kept, restorable",
        params: {
          type: "object",
          required: ["lenderOrgId"],
          properties: {
            lenderOrgId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const { lenderOrgId } = request.params;
      const actor = request.user || {};

      try {
        const data = await softDeleteLenderOrg(prisma, lenderOrgId, actor);

        adminLogs.info("Lender soft-deleted", {
          lenderOrgId,
          name: data.name,
          actor: actor.userId ?? actor,
        });

        return reply.send({
          success: true,
          message: `Lender deleted. Data is kept for ${data.retentionDays} days and can be restored from Deleted lenders. After that it is permanently removed.`,
          data,
        });
      } catch (error) {
        adminLogs.error("Soft delete lender failed", {
          error,
          lenderOrgId,
        });

        const status = error?.statusCode || 500;
        return reply.status(status).send({
          success: false,
          message: error?.message || "Could not delete lender.",
        });
      }
    },
  );
}

module.exports = softDeleteLenderRoutes;
