// routes/admin/lenders/softDelete.js
const { adminLogs } = require("../../../services/logger/contextLogger");

/**
 * Soft-delete a lender org (recommended for Admin Portal).
 * Hides from lender lists (isDeleted), deactivates access/products, disables users.
 * Does not wipe historical applications — use /hard for permanent wipe (dev/ops).
 */
async function softDeleteLenderRoutes(fastify) {
  fastify.delete(
    "/:lenderOrgId",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "Soft-delete a lender (hide + disable access)",
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
        const lender = await prisma.organization.findFirst({
          where: {
            id: lenderOrgId,
            type: "LENDER",
            isDeleted: { not: true },
          },
          select: { id: true, name: true, status: true },
        });

        if (!lender) {
          return reply.status(404).send({
            success: false,
            message: "Lender not found or already deleted.",
          });
        }

        await prisma.$transaction(async (tx) => {
          await tx.organization.update({
            where: { id: lenderOrgId },
            data: {
              isDeleted: true,
              deletedAt: new Date(),
              status: "INACTIVE",
            },
          });

          await tx.userAccount.updateMany({
            where: { organizationId: lenderOrgId },
            data: { status: "DISABLED" },
          });

          await tx.lenderProduct.updateMany({
            where: { lenderOrgId },
            data: { isActive: false },
          });

          await tx.brokerLenderAccess.updateMany({
            where: { lenderOrgId, isActive: true },
            data: { isActive: false },
          });

          await tx.auditLog.create({
            data: {
              actorUserId: actor.userId ?? null,
              actorOrgId: actor.orgId ?? null,
              dashboard: "PLATFORM",
              category: "USER_MANAGEMENT",
              action: "LENDER_ORG_SOFT_DELETED",
              entityType: "Organization",
              entityId: lenderOrgId,
              oldValueJson: JSON.stringify({
                status: lender.status,
                isDeleted: false,
              }),
              newValueJson: JSON.stringify({
                status: "INACTIVE",
                isDeleted: true,
                name: lender.name,
              }),
            },
          });
        });

        adminLogs.info("Lender soft-deleted", {
          lenderOrgId,
          name: lender.name,
          actor: actor.userId ?? actor,
        });

        return reply.send({
          success: true,
          message:
            "Lender removed from Admin Portal. Login access and broker links are disabled.",
          data: { id: lenderOrgId, name: lender.name },
        });
      } catch (error) {
        adminLogs.error("Soft delete lender failed", {
          error,
          lenderOrgId,
        });

        return reply.status(500).send({
          success: false,
          message: error?.message || "Could not delete lender.",
        });
      }
    },
  );
}

module.exports = softDeleteLenderRoutes;
