/**
 * Restore a soft-deleted lender org.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} lenderOrgId
 * @param {{ userId?: string|null, orgId?: string|null }} [actor]
 */
async function restoreLenderOrg(prisma, lenderOrgId, actor = {}) {
  const lender = await prisma.organization.findFirst({
    where: {
      id: lenderOrgId,
      type: "LENDER",
      isDeleted: true,
    },
    select: {
      id: true,
      name: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!lender) {
    const err = new Error("Deleted lender not found.");
    err.statusCode = 404;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: lenderOrgId },
      data: {
        isDeleted: false,
        deletedAt: null,
        status: "ACTIVE",
      },
    });

    await tx.userAccount.updateMany({
      where: {
        organizationId: lenderOrgId,
        status: "DISABLED",
      },
      data: { status: "ACTIVE" },
    });

    await tx.lenderProduct.updateMany({
      where: { lenderOrgId },
      data: { isActive: true },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: actor.userId ?? null,
        actorOrgId: actor.orgId ?? null,
        dashboard: "PLATFORM",
        category: "USER_MANAGEMENT",
        action: "LENDER_ORG_RESTORED",
        entityType: "Organization",
        entityId: lenderOrgId,
        oldValueJson: JSON.stringify({
          status: lender.status,
          isDeleted: true,
          deletedAt: lender.deletedAt,
        }),
        newValueJson: JSON.stringify({
          status: "ACTIVE",
          isDeleted: false,
          name: lender.name,
        }),
      },
    });
  });

  return { id: lender.id, name: lender.name };
}

async function restoreLendersBulk(prisma, ids, actor = {}) {
  const uniqueIds = [...new Set((ids || []).map(String).filter(Boolean))];
  const restored = [];
  const failed = [];

  for (const id of uniqueIds) {
    try {
      const row = await restoreLenderOrg(prisma, id, actor);
      restored.push(row);
    } catch (error) {
      failed.push({
        id,
        message: error?.message || "Could not restore lender.",
      });
    }
  }

  return {
    requested: uniqueIds.length,
    restored,
    failed,
  };
}

module.exports = {
  restoreLenderOrg,
  restoreLendersBulk,
};
