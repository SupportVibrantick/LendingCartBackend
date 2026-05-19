const STATUS_PRIORITY = {
  WITHDRAWN: 0,
  DECLINED: 1,
  SENT: 2,
  IN_REVIEW: 3,
  APPROVED: 4,
};

function getStatusPriority(status) {
  return STATUS_PRIORITY[status] ?? -1;
}

function getEffectiveStatus(record) {
  if (
    record?.status === "APPROVED" &&
    record?.loanApplication?.status === "FUNDED"
  ) {
    return "FUNDED";
  }

  return record?.status || "SENT";
}

function extractRequestedAmount(loanApplication) {
  const directAmount = Number(
    loanApplication?.amountRequested || 0,
  );

  if (directAmount > 0) {
    return directAmount;
  }

  const fields =
    loanApplication?.submissions?.[0]
      ?.fields || [];

  const amountField = fields.find(
    (field) =>
      field?.fieldKey ===
      "amountRequested",
  );

  return Number(amountField?.value || 0);
}

function consolidateApplicationLenders(records = []) {
  const grouped = new Map();

  for (const record of records) {
    if (!record?.loanApplicationId) {
      continue;
    }

    const existing = grouped.get(record.loanApplicationId);

    if (!existing) {
      grouped.set(record.loanApplicationId, record);
      continue;
    }

    const currentPriority = getStatusPriority(record.status);
    const existingPriority = getStatusPriority(existing.status);
    const currentUpdatedAt = new Date(
      record.lastUpdatedAt || record.sentAt || record.loanApplication?.createdAt || 0,
    ).getTime();
    const existingUpdatedAt = new Date(
      existing.lastUpdatedAt ||
        existing.sentAt ||
        existing.loanApplication?.createdAt ||
        0,
    ).getTime();

    if (
      currentPriority > existingPriority ||
      (currentPriority === existingPriority &&
        currentUpdatedAt > existingUpdatedAt)
    ) {
      grouped.set(record.loanApplicationId, record);
    }
  }

  return Array.from(grouped.values()).map((record) => ({
    ...record,
    effectiveStatus: getEffectiveStatus(record),
    amountRequested:
      extractRequestedAmount(
        record?.loanApplication,
      ),
    activityAt:
      record?.sentAt ||
      record?.lastUpdatedAt ||
      record?.loanApplication?.createdAt ||
      null,
  }));
}

function percentage(numerator, denominator, precision = 1) {
  if (!denominator) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(precision));
}

module.exports = {
  consolidateApplicationLenders,
  extractRequestedAmount,
  percentage,
};
