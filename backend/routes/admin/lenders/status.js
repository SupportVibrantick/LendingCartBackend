// routes/admin/lenders/status.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { adminLogs } = require("../../../services/logger/contextLogger.js");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderStatusRoutes(fastify) {
  /**
   * Toggle LENDER org status inside a transaction.
   * - Only allowed if lender is NOT under any active broker (BrokerLenderAccess).
   * - toActive: boolean (true -> ACTIVE, false -> INACTIVE)
   * - actor: optional { userId, orgId } to record in audit log
   *
   * Returns:
   *   null -> org not found / not LENDER
   *   { blockedByBroker: true, ... } -> has active broker access, status NOT changed
   *   { id, name, previousStatus, status } -> status changed
   */
  async function toggleLenderStatusTx(tx, orgId, toActive, actor = {}) {
    const org = await tx.organization.findUnique({
      where: { id: orgId },
      select: { id: true, type: true, name: true, status: true },
    });

    if (!org || org.type !== "LENDER") return null;

    // Check if this lender is assigned to any active broker
    const activeBrokerLinks = await tx.brokerLenderAccess.count({
      where: {
        lenderOrgId: orgId,
        isActive: true,
      },
    });

    if (activeBrokerLinks > 0) {
      // Do NOT change status, just return info so caller can respond with 400
      return {
        id: org.id,
        name: org.name,
        currentStatus: org.status,
        blockedByBroker: true,
        activeBrokerLinks,
      };
    }

    const newStatus = toActive ? "ACTIVE" : "INACTIVE";

    // 1) Update organization status
    await tx.organization.update({
      where: { id: orgId },
      data: { status: newStatus },
    });

    // 2) Update user accounts for this lender org
    await tx.userAccount.updateMany({
      where: { organizationId: orgId },
      data: { status: toActive ? "ACTIVE" : "DISABLED" },
    });

    // 3) Update lender products for this lender
    await tx.lenderProduct.updateMany({
      where: { lenderOrgId: orgId },
      data: { isActive: toActive },
    });

    // 4) Audit log
    await tx.auditLog.create({
      data: {
        actorUserId: actor.userId ?? null,
        actorOrgId: actor.orgId ?? null,
        entityType: "Organization",
        entityId: orgId,
        action: toActive ? "LENDER_ORG_ACTIVATED" : "LENDER_ORG_DEACTIVATED",
        oldValueJson: JSON.stringify({ status: org.status }),
        newValueJson: JSON.stringify({ status: newStatus }),
      },
    });

    return {
      id: org.id,
      name: org.name,
      previousStatus: org.status,
      status: newStatus,
      blockedByBroker: false,
    };
  }

  // ---- single deactivate ----
  fastify.patch(
    "/deactivate/:id",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "Deactivate a lender (single)",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const id = request.params.id;
      const actor = request.user || {};

      try {
        const result = await prisma.$transaction((tx) =>
          toggleLenderStatusTx(tx, id, false, actor)
        );

        if (!result) {
          return reply
            .status(404)
            .send({ success: false, message: "Lender not found" });
        }

        if (result.blockedByBroker) {
          return reply.status(400).send({
            success: false,
            message:
              "Cannot change status for this lender because it is assigned to one or more brokers. Please remove broker access first.",
            data: {
              id: result.id,
              name: result.name,
              currentStatus: result.currentStatus,
              activeBrokerLinks: result.activeBrokerLinks,
            },
          });
        }

        adminLogs.info("Lender deactivated", {
          orgId: id,
          actor: actor.userId ?? actor,
        });

        return reply.send({
          success: true,
          message: "Lender deactivated",
          data: result,
        });
      } catch (err) {
        adminLogs.error("Deactivate lender failed", { err, orgId: id });
        return reply
          .status(500)
          .send({ success: false, message: "Server error" });
      }
    }
  );

  // ---- single activate ----
  fastify.patch(
    "/activate/:id",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "Activate a lender (single)",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    },
    async (request, reply) => {
      const id = request.params.id;
      const actor = request.user || {};

      try {
        const result = await prisma.$transaction((tx) =>
          toggleLenderStatusTx(tx, id, true, actor)
        );

        if (!result) {
          return reply
            .status(404)
            .send({ success: false, message: "Lender not found" });
        }

        if (result.blockedByBroker) {
          return reply.status(400).send({
            success: false,
            message:
              "Cannot change status for this lender because it is assigned to one or more brokers. Please remove broker access first.",
            data: {
              id: result.id,
              name: result.name,
              currentStatus: result.currentStatus,
              activeBrokerLinks: result.activeBrokerLinks,
            },
          });
        }

        adminLogs.info("Lender activated", {
          orgId: id,
          actor: actor.userId ?? actor,
        });

        return reply.send({
          success: true,
          message: "Lender activated",
          data: result,
        });
      } catch (err) {
        adminLogs.error("Activate lender failed", { err, orgId: id });
        return reply
          .status(500)
          .send({ success: false, message: "Server error" });
      }
    }
  );

  // ---- bulk deactivate ----
  fastify.patch(
    "/deactivate",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "Deactivate multiple lenders (bulk)",
        body: {
          type: "object",
          required: ["ids"],
          properties: {
            ids: { type: "array", items: { type: "string" }, minItems: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { ids } = request.body || {};
      const actor = request.user || {};

      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({
          success: false,
          message: "ids is required and must be a non-empty array",
        });
      }

      try {
        const changed = [];
        const blocked = [];
        await prisma.$transaction(async (tx) => {
          for (const id of ids) {
            const res = await toggleLenderStatusTx(tx, id, false, actor);
            if (!res) continue;
            if (res.blockedByBroker) blocked.push(res);
            else changed.push(res);
          }
        });

        adminLogs.info("Bulk lenders deactivated", {
          requestedIds: ids,
          deactivatedCount: changed.length,
          blockedCount: blocked.length,
          actor: actor.userId ?? actor,
        });

        return reply.send({
          success: true,
          message: "Lenders deactivated (some may be blocked by broker links)",
          count: changed.length,
          blocked: blocked.length,
          data: changed,
          blockedDetails: blocked,
        });
      } catch (err) {
        adminLogs.error("Bulk deactivate lenders failed", { err, ids });
        return reply
          .status(500)
          .send({ success: false, message: "Server error" });
      }
    }
  );

  // ---- bulk activate ----
  fastify.patch(
    "/activate",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "Activate multiple lenders (bulk)",
        body: {
          type: "object",
          required: ["ids"],
          properties: {
            ids: { type: "array", items: { type: "string" }, minItems: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { ids } = request.body || {};
      const actor = request.user || {};

      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({
          success: false,
          message: "ids is required and must be a non-empty array",
        });
      }

      try {
        const changed = [];
        const blocked = [];
        await prisma.$transaction(async (tx) => {
          for (const id of ids) {
            const res = await toggleLenderStatusTx(tx, id, true, actor);
            if (!res) continue;
            if (res.blockedByBroker) blocked.push(res);
            else changed.push(res);
          }
        });

        adminLogs.info("Bulk lenders activated", {
          requestedIds: ids,
          activatedCount: changed.length,
          blockedCount: blocked.length,
          actor: actor.userId ?? actor,
        });

        return reply.send({
          success: true,
          message: "Lenders activated (some may be blocked by broker links)",
          count: changed.length,
          blocked: blocked.length,
          data: changed,
          blockedDetails: blocked,
        });
      } catch (err) {
        adminLogs.error("Bulk activate lenders failed", { err, ids });
        return reply
          .status(500)
          .send({ success: false, message: "Server error" });
      }
    }
  );
}

module.exports = lenderStatusRoutes;
