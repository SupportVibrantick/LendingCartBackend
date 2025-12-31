// routes/admin/brokers/status.js
const { adminLogs } = require("../../../services/logger/contextLogger.js");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function statusRoutes(fastify) {
 
  async function toggleOrgStatusTx(tx, orgId, toActive, actor = {}) {
    const prisma = fastify.prisma;
    const org = await tx.organization.findUnique({
      where: { id: orgId },
      select: { id: true, type: true, name: true, status: true },
    });
    if (!org || org.type !== "BROKER") return null;

    const newStatus = toActive ? "ACTIVE" : "INACTIVE";

    // update organization status
    await tx.organization.update({
      where: { id: orgId },
      data: { status: newStatus },
    });

    // update user accounts for this org: enable/disable
    await tx.userAccount.updateMany({
      where: { organizationId: orgId },
      data: { status: toActive ? "ACTIVE" : "DISABLED" },
    });

    // update clients belonging to this broker
    const clients = await tx.client.findMany({ where: { primaryBrokerOrgId: orgId }, select: { id: true } });
    const clientIds = clients.map((c) => c.id);

    if (clientIds.length) {
      await tx.client.updateMany({
        where: { id: { in: clientIds } },
        data: { isActive: toActive },
      });

      // update client portal users for those clients
      await tx.clientPortalUser.updateMany({
        where: { clientId: { in: clientIds } },
        data: { isActive: toActive },
      });
    }

    // optional: disable/enable broker-lender access, affiliate links, lender products
    // uncomment if desired:
    await tx.brokerLenderAccess.updateMany({
      where: { brokerOrgId: orgId },
      data: { isActive: toActive },
    });

    await tx.affiliateLink.updateMany({
      where: { brokerOrgId: orgId },
      data: { isActive: toActive },
    });

    await tx.lenderProduct.updateMany({
      where: { lenderOrgId: orgId },
      data: { isActive: toActive },
    });

    // create an audit log entry
    await tx.auditLog.create({
      data: {
        actorUserId: actor.userId ?? null,
        actorOrgId: actor.orgId ?? null,
        entityType: "Organization",
        entityId: orgId,
        action: toActive ? "ORG_ACTIVATED" : "ORG_DEACTIVATED",
        oldValueJson: JSON.stringify({ status: org.status }),
        newValueJson: JSON.stringify({ status: newStatus }),
      },
    });

    return { id: org.id, name: org.name, previousStatus: org.status, status: newStatus };
  }

  // ---- single deactivate ----
  fastify.patch(
    "/deactivate/:id",
    {
      schema: {
        tags: ["Admin -> Brokers"],
        summary: "Deactivate a broker (single)",
        params: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      },
    },
    async (request, reply) => {
      const id = request.params.id;
      // actor info expected on request.user (adapt if your auth uses different shape)
      const actor = request.user || {};

      try {
        const result = await prisma.$transaction(async (tx) => {
          return await toggleOrgStatusTx(tx, id, false, actor);
        });

        if (!result) {
          return reply.status(404).send({ success: false, message: "Broker not found" });
        }

        adminLogs.info("Broker deactivated", { orgId: id, actor: actor.userId ?? actor });
        return reply.send({ success: true, message: "Broker deactivated", data: result });
      } catch (err) {
        adminLogs.error("Deactivate broker failed", { err, orgId: id });
        return reply.status(500).send({ success: false, message: "Server error" });
      }
    }
  );

  // ---- single activate ----
  fastify.patch(
    "/activate/:id",
    {
      schema: {
        tags: ["Admin -> Brokers"],
        summary: "Activate a broker (single)",
        params: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      },
    },
    async (request, reply) => {
      const id = request.params.id;
      const actor = request.user || {};

      try {
        const result = await prisma.$transaction(async (tx) => {
          return await toggleOrgStatusTx(tx, id, true, actor);
        });

        if (!result) {
          return reply.status(404).send({ success: false, message: "Broker not found" });
        }

        adminLogs.info("Broker activated", { orgId: id, actor: actor.userId ?? actor });
        return reply.send({ success: true, message: "Broker activated", data: result });
      } catch (err) {
        adminLogs.error("Activate broker failed", { err, orgId: id });
        return reply.status(500).send({ success: false, message: "Server error" });
      }
    }
  );

  // ---- bulk deactivate ----
  fastify.patch(
    "/deactivate",
    {
      schema: {
        tags: ["Admin -> Brokers"],
        summary: "Deactivate multiple brokers (bulk)",
        body: {
          type: "object",
          required: ["ids"],
          properties: {
            ids: { type: "array", items: { type: "string" }, minItems: 1 },
            // optional reason or metadata can be added here
          },
        },
      },
    },
    async (request, reply) => {
      const { ids } = request.body || {};
      const actor = request.user || {};

      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({ success: false, message: "ids is required and must be a non-empty array" });
      }

      try {
        const results = [];
        await prisma.$transaction(async (tx) => {
          for (const id of ids) {
            const res = await toggleOrgStatusTx(tx, id, false, actor);
            if (res) results.push(res);
          }
        });

        adminLogs.info("Bulk brokers deactivated", { requestedIds: ids, deactivatedCount: results.length, actor: actor.userId ?? actor });
        return reply.send({ success: true, message: "Brokers deactivated", count: results.length, data: results });
      } catch (err) {
        adminLogs.error("Bulk deactivate failed", { err, ids });
        return reply.status(500).send({ success: false, message: "Server error" });
      }
    }
  );

  // ---- bulk activate ----
  fastify.patch(
    "/activate",
    {
      schema: {
        tags: ["Admin -> Brokers"],
        summary: "Activate multiple brokers (bulk)",
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
        return reply.status(400).send({ success: false, message: "ids is required and must be a non-empty array" });
      }

      try {
        const results = [];
        await prisma.$transaction(async (tx) => {
          for (const id of ids) {
            const res = await toggleOrgStatusTx(tx, id, true, actor);
            if (res) results.push(res);
          }
        });

        adminLogs.info("Bulk brokers activated", { requestedIds: ids, activatedCount: results.length, actor: actor.userId ?? actor });
        return reply.send({ success: true, message: "Brokers activated", count: results.length, data: results });
      } catch (err) {
        adminLogs.error("Bulk activate failed", { err, ids });
        return reply.status(500).send({ success: false, message: "Server error" });
      }
    }
  );
}

module.exports = statusRoutes;
