const {
  formatCommissionRecord,
  decimalToNumber,
  roundMoney,
} = require("../../utils/commission/commissionHelpers");
const { commissionInclude } = require("../../utils/commission/commissionQueryHelpers");

async function assertLoanCommissionAccess(prisma, loan, userId, { role } = {}) {
  if (!loan) {
    const error = new Error("Loan application not found");
    error.statusCode = 404;
    throw error;
  }

  if (role === "LOAN_OFFICER") {
    if (loan.brokerUserId !== userId) {
      const error = new Error("You do not have access to this commission breakdown");
      error.statusCode = 403;
      throw error;
    }
    return;
  }

  if (role === "CO_BROKER") {
    const assignment = await prisma.subBrokerApplication.findFirst({
      where: { loanApplicationId: loan.id, subBrokerId: userId },
    });
    if (!assignment) {
      const error = new Error("You do not have access to this commission breakdown");
      error.statusCode = 403;
      throw error;
    }
    return;
  }

  const isAssignedOfficer = loan.brokerUserId === userId;
  const isAssignedCoBroker = await prisma.subBrokerApplication.findFirst({
    where: { loanApplicationId: loan.id, subBrokerId: userId },
  });

  if (!isAssignedOfficer && !isAssignedCoBroker) {
    const error = new Error("You do not have access to this commission breakdown");
    error.statusCode = 403;
    throw error;
  }
}

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 */
async function getLoanCommissionBreakdown(
  prisma,
  loanId,
  brokerOrgId,
  {
    viewerUserId = null,
    recipientRole = null,
    autoCalcIfMissing = false,
    requireAccess = false,
  } = {},
) {
  const loan = await prisma.loanApplication.findFirst({
    where: { id: loanId, brokerOrgId },
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      amountRequested: true,
      fundedAt: true,
      brokerUserId: true,
    },
  });

  if (!loan) {
    const error = new Error("Loan application not found");
    error.statusCode = 404;
    throw error;
  }

  if (requireAccess && viewerUserId) {
    await assertLoanCommissionAccess(prisma, loan, viewerUserId, {
      role: recipientRole,
    });
  }

  let allRows = await prisma.dealCommission.findMany({
    where: { loanApplicationId: loanId, brokerOrgId, status: "CALCULATED" },
    include: commissionInclude,
    orderBy: [{ recipientRole: "asc" }, { createdAt: "asc" }],
  });

  let calculationWarnings = [];

  if (loan.status === "FUNDED" && allRows.length === 0 && autoCalcIfMissing) {
    try {
      const { calculateDealCommissions } = require("../applications/calculateDealCommissions");
      const result = await calculateDealCommissions(prisma, loanId);
      calculationWarnings = result.warnings || [];
      allRows = await prisma.dealCommission.findMany({
        where: { loanApplicationId: loanId, brokerOrgId, status: "CALCULATED" },
        include: commissionInclude,
        orderBy: [{ recipientRole: "asc" }, { createdAt: "asc" }],
      });
    } catch (calcError) {
      calculationWarnings = [calcError.message || "Failed to calculate commissions"];
      return {
        loanApplicationId: loan.id,
        applicationNumber: loan.applicationNumber,
        status: loan.status,
        fundedAt: loan.fundedAt,
        commissionPool: 0,
        brokerRetained: 0,
        upfrontFee: null,
        brokerPoints: null,
        loanAmount: decimalToNumber(loan.amountRequested),
        commissions: [],
        warnings: calculationWarnings,
        staffView: Boolean(viewerUserId && recipientRole),
      };
    }
  }

  let rows = allRows;
  if (viewerUserId) {
    rows = allRows.filter(
      (row) =>
        row.recipientUserId === viewerUserId &&
        (!recipientRole || row.recipientRole === recipientRole),
    );
  }

  const pool = allRows[0] ? decimalToNumber(allRows[0].commissionPool) : 0;
  const brokerRow = allRows.find((row) => row.recipientRole === "BROKER");
  const staffRows = allRows.filter((row) => row.recipientRole !== "BROKER");
  const staffTotal = staffRows.reduce(
    (sum, row) => sum + (decimalToNumber(row.commissionAmount) || 0),
    0,
  );

  const viewerTotal = rows.reduce(
    (sum, row) => sum + (decimalToNumber(row.commissionAmount) || 0),
    0,
  );

  const metaRow = allRows[0] || rows[0];

  return {
    loanApplicationId: loan.id,
    applicationNumber: loan.applicationNumber,
    status: loan.status,
    fundedAt: loan.fundedAt,
    commissionPool: pool,
    brokerRetained: brokerRow
      ? decimalToNumber(brokerRow.commissionAmount)
      : roundMoney(pool - staffTotal),
    upfrontFee: metaRow?.upfrontFee ? decimalToNumber(metaRow.upfrontFee) : null,
    brokerPoints: metaRow?.brokerPoints ? decimalToNumber(metaRow.brokerPoints) : null,
    loanAmount: metaRow?.loanAmount
      ? decimalToNumber(metaRow.loanAmount)
      : decimalToNumber(loan.amountRequested),
    yourCommission: viewerUserId ? roundMoney(viewerTotal) : null,
    commissions: rows.map((row) => formatCommissionRecord(row)),
    warnings: calculationWarnings,
    staffView: Boolean(viewerUserId && recipientRole),
  };
}

module.exports = {
  getLoanCommissionBreakdown,
  assertLoanCommissionAccess,
};
