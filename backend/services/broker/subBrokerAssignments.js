const { uniqueIds } = require("./loanOfficerAssignments");

async function replaceSubBrokerAssignments(
  prisma,
  { loanApplicationId, subBrokerIds, assignedById },
) {
  const ids = uniqueIds(subBrokerIds);
  const existing = await prisma.subBrokerApplication.findMany({
    where: { loanApplicationId },
    select: { subBrokerId: true },
  });
  const existingIds = existing.map((row) => row.subBrokerId);
  const toRemove = existingIds.filter((id) => !ids.includes(id));
  const toAdd = ids.filter((id) => !existingIds.includes(id));

  if (toRemove.length > 0) {
    await prisma.subBrokerApplication.deleteMany({
      where: {
        loanApplicationId,
        subBrokerId: { in: toRemove },
      },
    });
  }

  if (toAdd.length > 0) {
    await prisma.subBrokerApplication.createMany({
      data: toAdd.map((subBrokerId) => ({
        loanApplicationId,
        subBrokerId,
        assignedById: assignedById || null,
      })),
      skipDuplicates: true,
    });
  }

  return { addedIds: toAdd, removedIds: toRemove, allIds: ids };
}

module.exports = {
  replaceSubBrokerAssignments,
};
