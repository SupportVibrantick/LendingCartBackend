const {
  roundMoney,
  parseFindersFeePercent,
  resolveCommissionLoanAmount,
} = require("../utils/commissionHelpers");
const { logCommissionAuditEvent } = require("./commission/auditCommissionEvent");

const commissionLineInclude = {
  recipientUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  loanApplication: {
    select: {
      applicationNumber: true,
      fundedAt: true,
      client: { select: { legalName: true } },
    },
  },
  invoices: {
    orderBy: { generatedAt: "desc" },
    take: 5,
  },
  payouts: {
    where: { status: "COMPLETED" },
    orderBy: { paidAt: "desc" },
    include: {
      paidByUser: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
};

async function resolveBrokerRecipientUserId(db, loan) {
  if (loan.fundedByUserId) {
    return loan.fundedByUserId;
  }

  const admin = await db.userAccount.findFirst({
    where: {
      organizationId: loan.brokerOrgId,
      isDeleted: false,
      status: "ACTIVE",
      roles: {
        some: {
          role: { name: "BROKER_ADMIN" },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return admin?.id || null;
}

async function calculateDealCommissions(db, loanApplicationId) {
  const loan = await db.loanApplication.findUnique({
    where: { id: loanApplicationId },
    include: {
      feeAgreement: true,
      client: { select: { legalName: true } },
      subBrokerAssignments: {
        include: {
          subBroker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              subBrokerProfile: { select: { profileData: true } },
            },
          },
        },
      },
      brokerUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          brokerProfile: { select: { profileData: true } },
        },
      },
      submissions: {
        where: { status: { not: "SUPERSEDED" } },
        orderBy: { createdAt: "desc" },
        include: {
          fields: {
            include: { builderField: true },
          },
        },
      },
      fundedApplicationLender: {
        include: {
          lenderReviews: {
            where: { reviewStatus: "APPROVED" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { approvedAmount: true },
          },
        },
      },
    },
  });

  if (!loan) {
    throw new Error("Loan application not found");
  }

  if (loan.status !== "FUNDED") {
    throw new Error("Commissions can only be calculated for funded applications");
  }

  const existing = await db.dealCommission.findMany({
    where: { loanApplicationId, status: "CALCULATED" },
    include: commissionLineInclude,
    orderBy: { createdAt: "asc" },
  });

  if (existing.length > 0) {
    const pool = existing[0]?.commissionPool ? Number(existing[0].commissionPool) : 0;
    const staffRows = existing.filter((row) => row.recipientRole !== "BROKER");
    const brokerRow = existing.find((row) => row.recipientRole === "BROKER");
    const totalStaff = staffRows.reduce(
      (sum, row) => sum + Number(row.commissionAmount || 0),
      0,
    );

    return {
      alreadyCalculated: true,
      loanApplicationId,
      commissionPool: roundMoney(pool),
      brokerRetained: brokerRow
        ? Number(brokerRow.commissionAmount)
        : roundMoney(pool - totalStaff),
      upfrontFee: existing[0]?.upfrontFee ? Number(existing[0].upfrontFee) : null,
      commissions: existing,
      warnings: [],
    };
  }

  const loanAmount = resolveCommissionLoanAmount(loan);
  if (!loanAmount || loanAmount <= 0) {
    throw new Error("Loan amount is required to calculate commissions");
  }

  const brokerPoints = loan.feeAgreement?.brokerPoints
    ? Number(loan.feeAgreement.brokerPoints)
    : null;

  if (brokerPoints == null || brokerPoints <= 0) {
    throw new Error("Fee agreement broker points are required to calculate commissions");
  }

  const upfrontFee = loan.feeAgreement?.upfrontFee
    ? Number(loan.feeAgreement.upfrontFee)
    : null;

  const commissionPool = roundMoney((loanAmount * brokerPoints) / 100);
  const recipients = [];
  const warnings = [];

  if (loan.brokerUserId && loan.brokerUser) {
    const findersFeePercent = parseFindersFeePercent(
      loan.brokerUser.brokerProfile?.profileData,
    );
    if (findersFeePercent) {
      recipients.push({
        recipientUserId: loan.brokerUserId,
        recipientRole: "LOAN_OFFICER",
        findersFeePercent,
        commissionAmount: roundMoney((commissionPool * findersFeePercent) / 100),
      });
    } else {
      warnings.push("Assigned loan officer has no approved finders fee configured");
    }
  }

  for (const assignment of loan.subBrokerAssignments || []) {
    const subBroker = assignment.subBroker;
    if (!subBroker?.id) continue;

    const findersFeePercent = parseFindersFeePercent(
      subBroker.subBrokerProfile?.profileData,
    );
    if (!findersFeePercent) {
      warnings.push(
        `Co-broker ${subBroker.email || subBroker.id} has no approved finders fee configured`,
      );
      continue;
    }

    recipients.push({
      recipientUserId: subBroker.id,
      recipientRole: "CO_BROKER",
      findersFeePercent,
      commissionAmount: roundMoney((commissionPool * findersFeePercent) / 100),
    });
  }

  const totalFindersPercent = recipients.reduce(
    (sum, recipient) => sum + recipient.findersFeePercent,
    0,
  );

  if (totalFindersPercent > 100) {
    throw new Error(
      `Total finders fee (${totalFindersPercent}%) exceeds 100% of the broker commission pool`,
    );
  }

  const totalStaffAmount = recipients.reduce(
    (sum, recipient) => sum + recipient.commissionAmount,
    0,
  );

  const brokerRetainAmount = roundMoney(commissionPool - totalStaffAmount);
  const brokerRetainPercent = roundMoney(
    commissionPool > 0 ? (brokerRetainAmount / commissionPool) * 100 : 0,
  );

  const brokerRecipientUserId = await resolveBrokerRecipientUserId(db, loan);
  if (brokerRecipientUserId && brokerRetainAmount > 0) {
    recipients.push({
      recipientUserId: brokerRecipientUserId,
      recipientRole: "BROKER",
      findersFeePercent: brokerRetainPercent,
      commissionAmount: brokerRetainAmount,
    });
  } else if (brokerRetainAmount > 0) {
    warnings.push("Broker retained amount could not be assigned to a broker user");
  }

  if (recipients.length === 0) {
    return {
      alreadyCalculated: false,
      loanApplicationId,
      commissionPool,
      brokerRetained: commissionPool,
      upfrontFee,
      commissions: [],
      warnings: warnings.length
        ? warnings
        : ["No commission recipients were found for this funded deal"],
    };
  }

  const created = [];

  for (const recipient of recipients) {
    const row = await db.dealCommission.create({
      data: {
        loanApplicationId: loan.id,
        brokerOrgId: loan.brokerOrgId,
        recipientUserId: recipient.recipientUserId,
        recipientRole: recipient.recipientRole,
        loanAmount,
        brokerPoints,
        upfrontFee,
        commissionPool,
        findersFeePercent: recipient.findersFeePercent,
        commissionAmount: recipient.commissionAmount,
        status: "CALCULATED",
      },
      include: commissionLineInclude,
    });

    await logCommissionAuditEvent(db, {
      brokerOrgId: loan.brokerOrgId,
      loanApplicationId: loan.id,
      dealCommissionId: row.id,
      eventType: "COMMISSION_CALCULATED",
      actorType: "SYSTEM",
      metadata: {
        recipientRole: recipient.recipientRole,
        recipientUserId: recipient.recipientUserId,
        amount: recipient.commissionAmount,
        commissionPool,
      },
    });

    created.push(row);
  }

  const brokerRow = created.find((row) => row.recipientRole === "BROKER");

  return {
    alreadyCalculated: false,
    loanApplicationId,
    commissionPool,
    brokerRetained: brokerRow
      ? Number(brokerRow.commissionAmount)
      : brokerRetainAmount,
    upfrontFee,
    commissions: created,
    warnings,
  };
}

module.exports = {
  calculateDealCommissions,
  commissionLineInclude,
};
