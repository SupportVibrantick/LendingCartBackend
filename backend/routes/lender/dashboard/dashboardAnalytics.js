const STATUS_PRIORITY = {
  WITHDRAWN: 0,
  DECLINED: 1,
  SENT: 2,
  IN_REVIEW: 3,
  APPROVED: 4,
};

const PERIOD_PRESETS = {
  "7d": { days: 7, granularity: "day" },
  "30d": { days: 30, granularity: "week" },
  "90d": { days: 90, granularity: "week" },
  "12m": { months: 12, granularity: "month" },
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

function parseAmount(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[$,\s]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractRequestedAmount(loanApplication) {
  const directAmount = parseAmount(loanApplication?.amountRequested);

  if (directAmount > 0) {
    return directAmount;
  }

  const fields = loanApplication?.submissions?.[0]?.fields || [];

  const amountField = fields.find(
    (field) => field?.fieldKey === "amountRequested",
  );

  return parseAmount(amountField?.value);
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
      record.lastUpdatedAt ||
        record.sentAt ||
        record.loanApplication?.createdAt ||
        0,
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
    amountRequested: extractRequestedAmount(record?.loanApplication),
    activityAt:
      record?.lastUpdatedAt ||
      record?.sentAt ||
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

function startOfUtcDay(date) {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function startOfUtcWeek(date) {
  const next = startOfUtcDay(date);
  const day = next.getUTCDay();
  const diff = (day + 6) % 7;
  next.setUTCDate(next.getUTCDate() - diff);
  return next;
}

function startOfUtcMonth(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(date, months) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 0, 0, 0, 0),
  );
}

function resolvePeriod(periodKey) {
  const key = PERIOD_PRESETS[periodKey] ? periodKey : "12m";
  const preset = PERIOD_PRESETS[key];
  const end = new Date();
  let start;

  if (preset.days) {
    start = startOfUtcDay(addUtcDays(end, -(preset.days - 1)));
  } else {
    start = startOfUtcMonth(addUtcMonths(end, -(preset.months - 1)));
  }

  const durationMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  return {
    key,
    granularity: preset.granularity,
    start,
    end,
    previousStart,
    previousEnd,
  };
}

function inRange(dateValue, start, end) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
}

function bucketKeyForDate(dateValue, granularity) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  if (granularity === "day") {
    return startOfUtcDay(date).toISOString().slice(0, 10);
  }
  if (granularity === "week") {
    return startOfUtcWeek(date).toISOString().slice(0, 10);
  }

  const monthStart = startOfUtcMonth(date);
  return `${monthStart.getUTCFullYear()}-${String(
    monthStart.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

function formatBucketLabel(key, granularity) {
  if (granularity === "month") {
    const [year, month] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  }

  const date = new Date(`${key}T00:00:00.000Z`);
  if (granularity === "week") {
    return `Week of ${new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date)}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function createTrendBuckets(period) {
  const buckets = [];
  const { granularity, start, end } = period;

  if (granularity === "month") {
    let cursor = startOfUtcMonth(start);
    const last = startOfUtcMonth(end);
    while (cursor <= last) {
      const key = `${cursor.getUTCFullYear()}-${String(
        cursor.getUTCMonth() + 1,
      ).padStart(2, "0")}`;
      buckets.push({
        key,
        label: formatBucketLabel(key, granularity),
        applications: 0,
        approved: 0,
        funded: 0,
        fundedVolume: 0,
      });
      cursor = addUtcMonths(cursor, 1);
    }
    return buckets;
  }

  let cursor =
    granularity === "week" ? startOfUtcWeek(start) : startOfUtcDay(start);
  const last =
    granularity === "week" ? startOfUtcWeek(end) : startOfUtcDay(end);
  const stepDays = granularity === "week" ? 7 : 1;

  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.push({
      key,
      label: formatBucketLabel(key, granularity),
      applications: 0,
      approved: 0,
      funded: 0,
      fundedVolume: 0,
    });
    cursor = addUtcDays(cursor, stepDays);
  }

  return buckets;
}

function changePercent(current, previous) {
  if (!Number.isFinite(previous) || previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function filterAppsInPeriod(applications, start, end) {
  return (applications || []).filter((app) =>
    inRange(app.activityAt || app.sentAt, start, end),
  );
}

module.exports = {
  consolidateApplicationLenders,
  extractRequestedAmount,
  parseAmount,
  percentage,
  resolvePeriod,
  createTrendBuckets,
  bucketKeyForDate,
  inRange,
  changePercent,
  filterAppsInPeriod,
};
