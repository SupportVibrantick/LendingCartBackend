const {
  getDeletedLenderRetentionDays,
} = require("./purgeExpiredDeletedLenders");

/**
 * Soft-delete a single lender org (hide + disable access). Data kept for restore.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} lenderOrgId
 * @param {{ userId?: string|null, orgId?: string|null }} [actor]
 */
async function softDeleteLenderOrg(prisma, lenderOrgId, actor = {}) {
  const lender = await prisma.organization.findFirst({
    where: {
      id: lenderOrgId,
      type: "LENDER",
      isDeleted: { not: true },
    },
    select: { id: true, name: true, status: true },
  });

  if (!lender) {
    const err = new Error("Lender not found or already deleted.");
    err.statusCode = 404;
    throw err;
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
        action: "LENDER_ORG_ARCHIVED",
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

  return {
    id: lender.id,
    name: lender.name,
    retentionDays: getDeletedLenderRetentionDays(),
  };
}

/**
 * Soft-delete many lenders. Continues on per-id failures.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string[]} ids
 * @param {{ userId?: string|null, orgId?: string|null }} [actor]
 */
async function softDeleteLendersBulk(prisma, ids, actor = {}) {
  const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
  const deleted = [];
  const failed = [];

  for (const id of uniqueIds) {
    try {
      const row = await softDeleteLenderOrg(prisma, id, actor);
      deleted.push(row);
    } catch (error) {
      failed.push({
        id,
        message: error?.message || "Could not delete lender.",
      });
    }
  }

  return {
    requested: uniqueIds.length,
    deleted,
    failed,
    retentionDays: getDeletedLenderRetentionDays(),
  };
}

module.exports = {
  softDeleteLenderOrg,
  softDeleteLendersBulk,
};
