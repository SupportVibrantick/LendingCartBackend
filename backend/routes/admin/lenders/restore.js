// routes/admin/lenders/restore.js
const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  restoreLenderOrg,
  restoreLendersBulk,
} = require("../../../services/lenders/restoreLender");

const MAX_BULK = 50;

/**
 * Restore soft-deleted lenders.
 * Broker links stay inactive — reconnect intentionally after restore.
 */
async function restoreLenderRoutes(fastify) {
  fastify.post(
    "/bulk",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "Restore multiple deleted lenders (bulk)",
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
          message: `You can restore at most ${MAX_BULK} lenders at once.`,
        });
      }

      try {
        const result = await restoreLendersBulk(prisma, ids, actor);

        adminLogs.info("Lenders bulk restored", {
          requested: result.requested,
          restoredCount: result.restored.length,
          failedCount: result.failed.length,
          actor: actor.userId ?? actor,
        });

        if (result.restored.length === 0) {
          return reply.status(404).send({
            success: false,
            message: "No lenders were restored.",
            data: result,
          });
        }

        return reply.send({
          success: true,
          message: `${result.restored.length} lender${
            result.restored.length === 1 ? "" : "s"
          } restored.`,
          data: result,
        });
      } catch (error) {
        adminLogs.error("Bulk restore lenders failed", { error, ids });
        return reply.status(500).send({
          success: false,
          message: error?.message || "Could not restore lenders.",
        });
      }
    },
  );

  fastify.post(
    "/:lenderOrgId",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "Restore a deleted lender",
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
        const data = await restoreLenderOrg(prisma, lenderOrgId, actor);

        adminLogs.info("Lender restored from soft-delete", {
          lenderOrgId,
          name: data.name,
          actor: actor.userId ?? actor,
        });

        return reply.send({
          success: true,
          message:
            "Lender restored. Login access is re-enabled. Broker links stay disconnected until reassigned.",
          data,
        });
      } catch (error) {
        adminLogs.error("Restore lender failed", {
          error,
          lenderOrgId,
        });

        const status = error?.statusCode || 500;
        return reply.status(status).send({
          success: false,
          message: error?.message || "Could not restore lender.",
        });
      }
    },
  );
}

module.exports = restoreLenderRoutes;
