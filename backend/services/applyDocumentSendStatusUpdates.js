const {
  shouldPreserveLoanApplicationStatus,
} = require("../utils/loanPipelineStatus");

/**
 * After documents are sent, move active lenders to IN_REVIEW without
 * downgrading approved/declined lenders or overwriting terminal loan statuses.
 */
async function applyDocumentSendStatusUpdates(
  prisma,
  { loanApplicationId, applicationLenderIds = [] },
) {
  const uniqueLenderIds = [
    ...new Set(
      (applicationLenderIds || []).filter(
        (id) => typeof id === "string" && id.trim(),
      ),
    ),
  ];

  if (uniqueLenderIds.length > 0) {
    await prisma.applicationLender.updateMany({
      where: {
        id: { in: uniqueLenderIds },
        loanApplicationId,
        status: { in: ["SENT", "IN_REVIEW"] },
      },
      data: {
        status: "IN_REVIEW",
        sentAt: new Date(),
      },
    });
  }

  const loan = await prisma.loanApplication.findUnique({
    where: { id: loanApplicationId },
    select: { status: true },
  });

  if (loan && !shouldPreserveLoanApplicationStatus(loan.status)) {
    await prisma.loanApplication.update({
      where: { id: loanApplicationId },
      data: { status: "IN_REVIEW" },
    });
  }
}

module.exports = { applyDocumentSendStatusUpdates };
