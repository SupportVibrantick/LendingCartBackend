function uniqueIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];
}

function isOfficerUser(user) {
  return Boolean(
    user?.roles?.some((role) => role.role?.name === "BROKER_OFFICER"),
  );
}

async function listAssignedLoanOfficerIds(prisma, loanApplicationId) {
  if (!loanApplicationId) return [];
  const rows = await prisma.loanOfficerApplication.findMany({
    where: { loanApplicationId },
    select: { loanOfficerId: true },
    orderBy: { assignedAt: "asc" },
  });
  return rows.map((row) => row.loanOfficerId);
}

async function ensurePrimaryBrokerUserId(prisma, loanApplicationId, preferredIds) {
  const application = await prisma.loanApplication.findUnique({
    where: { id: loanApplicationId },
    select: {
      brokerUserId: true,
      brokerUser: {
        select: {
          roles: {
            select: {
              role: { select: { name: true } },
            },
          },
        },
      },
      loanOfficerAssignments: {
        select: { loanOfficerId: true },
        orderBy: { assignedAt: "asc" },
      },
    },
  });

  if (!application) return null;

  const assignmentIds =
    preferredIds != null
      ? uniqueIds(preferredIds)
      : application.loanOfficerAssignments.map((row) => row.loanOfficerId);

  const currentIsOfficer = isOfficerUser(application.brokerUser);
  const keepCurrent =
    currentIsOfficer &&
    application.brokerUserId &&
    assignmentIds.includes(application.brokerUserId);
  const nextPrimary = keepCurrent
    ? application.brokerUserId
    : assignmentIds[0] || null;

  if (nextPrimary !== application.brokerUserId) {
    await prisma.loanApplication.update({
      where: { id: loanApplicationId },
      data: { brokerUserId: nextPrimary },
    });
  }

  return nextPrimary;
}

async function addLoanOfficerAssignments(
  prisma,
  { loanApplicationId, loanOfficerIds, assignedById },
) {
  const ids = uniqueIds(loanOfficerIds);
  if (!loanApplicationId || ids.length === 0) return [];

  await prisma.loanOfficerApplication.createMany({
    data: ids.map((loanOfficerId) => ({
      loanApplicationId,
      loanOfficerId,
      assignedById: assignedById || null,
    })),
    skipDuplicates: true,
  });

  await ensurePrimaryBrokerUserId(prisma, loanApplicationId);
  return ids;
}

async function replaceLoanOfficerAssignments(
  prisma,
  { loanApplicationId, loanOfficerIds, assignedById },
) {
  const ids = uniqueIds(loanOfficerIds);
  const existing = await prisma.loanOfficerApplication.findMany({
    where: { loanApplicationId },
    select: { loanOfficerId: true },
  });
  const existingIds = existing.map((row) => row.loanOfficerId);
  const toRemove = existingIds.filter((id) => !ids.includes(id));
  const toAdd = ids.filter((id) => !existingIds.includes(id));

  if (toRemove.length > 0) {
    await prisma.loanOfficerApplication.deleteMany({
      where: {
        loanApplicationId,
        loanOfficerId: { in: toRemove },
      },
    });
  }

  if (ids.length > 0) {
    await prisma.loanOfficerApplication.createMany({
      data: ids.map((loanOfficerId) => ({
        loanApplicationId,
        loanOfficerId,
        assignedById: assignedById || null,
      })),
      skipDuplicates: true,
    });
  }

  await ensurePrimaryBrokerUserId(prisma, loanApplicationId, ids);

  return { addedIds: toAdd, removedIds: toRemove, allIds: ids };
}

module.exports = {
  uniqueIds,
  listAssignedLoanOfficerIds,
  addLoanOfficerAssignments,
  replaceLoanOfficerAssignments,
  ensurePrimaryBrokerUserId,
};
