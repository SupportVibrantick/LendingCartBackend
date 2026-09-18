// Shared period-based dashboard analytics for broker / loan officer portals.

const PERIOD_PRESETS = {
  "7d": { days: 7, granularity: "day" },
  "30d": { days: 30, granularity: "week" },
  "90d": { days: 90, granularity: "week" },
  "12m": { months: 12, granularity: "month" },
};

const ANALYTICS_APPLICATION_SELECT = {
  id: true,
  status: true,
  amountRequested: true,
  loanProductCode: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  fundedAt: true,
  applicationLenders: {
    select: {
      status: true,
      lenderOrgId: true,
    },
  },
};

function parseAmount(value) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentage(numerator, denominator, precision = 1) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(precision));
}

function changePercent(current, previous) {
  if (!Number.isFinite(previous) || previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
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
        submitted: 0,
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
      submitted: 0,
      approved: 0,
      funded: 0,
      fundedVolume: 0,
    });
    cursor = addUtcDays(cursor, stepDays);
  }

  return buckets;
}

function inRange(dateValue, start, end) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
}

function isSubmittedApplication(application) {
  if (application?.submittedAt) return true;
  return !["DRAFT", "CLIENT_PENDING"].includes(application?.status);
}

function isApprovedApplication(application) {
  if (!application) return false;
  if (
    ["LENDER_APPROVED", "FUNDED", "AUTO_APPROVED", "LENDER_SELECTED"].includes(
      application.status,
    )
  ) {
    return true;
  }
  return application.applicationLenders?.some(
    (lender) => lender.status === "APPROVED",
  );
}

function isDeclinedApplication(application) {
  if (!application) return false;
  if (["LENDER_DECLINED", "AUTO_DECLINED"].includes(application.status)) {
    return true;
  }
  return (
    application.applicationLenders?.length > 0 &&
    application.applicationLenders.every((lender) => lender.status === "DECLINED")
  );
}

function resolveCurrentStage(application) {
  const status = application?.status;
  const lenders = application?.applicationLenders || [];

  if (status === "WITHDRAWN") return "WITHDRAWN";
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "FUNDED") return "FUNDED";
  if (isDeclinedApplication(application)) return "LENDER_DECLINED";
  if (isApprovedApplication(application)) return "LENDER_APPROVED";
  if (status === "LENDER_SELECTED") return "LENDER_SELECTED";
  if (
    status === "IN_REVIEW" ||
    lenders.some((lender) => lender.status === "IN_REVIEW")
  ) {
    return "IN_REVIEW";
  }
  if (status === "CLIENT_PENDING") return "CLIENT_PENDING";
  if (isSubmittedApplication(application)) return "SUBMITTED";
  return "DRAFT";
}

function emptyCounters() {
  return {
    totalApplications: 0,
    totalSubmitted: 0,
    totalInReview: 0,
    totalApproved: 0,
    totalDeclined: 0,
    totalFunded: 0,
    totalWithdrawn: 0,
    totalVolumeFunded: 0,
    uniqueLenderIds: new Set(),
    applicationsByStatus: {
      DRAFT: 0,
      CLIENT_PENDING: 0,
      SUBMITTED: 0,
      IN_REVIEW: 0,
      LENDER_SELECTED: 0,
      LENDER_APPROVED: 0,
      LENDER_DECLINED: 0,
      FUNDED: 0,
      WITHDRAWN: 0,
      SUSPENDED: 0,
    },
    productVolume: new Map(),
  };
}

function accumulateApplication(target, application, period, trendLookup) {
  const amount = parseAmount(application.amountRequested);
  const createdInPeriod = inRange(
    application.createdAt,
    period.start,
    period.end,
  );
  const submittedAt = application.submittedAt || application.createdAt;
  const submittedInPeriod =
    isSubmittedApplication(application) &&
    inRange(submittedAt, period.start, period.end);
  const fundedAt = application.fundedAt || application.updatedAt;
  const funded = application.status === "FUNDED";
  const fundedInPeriod = funded && inRange(fundedAt, period.start, period.end);
  const approved = isApprovedApplication(application);
  const approvedAt = application.fundedAt || application.updatedAt;
  const approvedInPeriod =
    approved && inRange(approvedAt, period.start, period.end);

  if (createdInPeriod) {
    target.totalApplications += 1;

    if (isSubmittedApplication(application)) {
      target.totalSubmitted += 1;
    }

    const stage = resolveCurrentStage(application);
    if (Object.prototype.hasOwnProperty.call(target.applicationsByStatus, stage)) {
      target.applicationsByStatus[stage] += 1;
    }

    if (stage === "IN_REVIEW") target.totalInReview += 1;
    if (stage === "LENDER_APPROVED" || stage === "FUNDED") {
      target.totalApproved += 1;
    }
    if (stage === "LENDER_DECLINED") target.totalDeclined += 1;
    if (stage === "WITHDRAWN") target.totalWithdrawn += 1;

    if (approved || funded) {
      const productKey = application.loanProductCode || "UNSPECIFIED";
      target.productVolume.set(
        productKey,
        (target.productVolume.get(productKey) || 0) + amount,
      );
    }

    for (const lender of application.applicationLenders || []) {
      if (lender.lenderOrgId) {
        target.uniqueLenderIds.add(lender.lenderOrgId);
      }
    }
  }

  if (fundedInPeriod) {
    target.totalFunded += 1;
    target.totalVolumeFunded += amount;
  }

  if (!trendLookup) return;

  const createdBucket = trendLookup.get(
    bucketKeyForDate(application.createdAt, period.granularity),
  );
  if (createdBucket && createdInPeriod) createdBucket.applications += 1;

  const submittedBucket = trendLookup.get(
    bucketKeyForDate(submittedAt, period.granularity),
  );
  if (submittedBucket && submittedInPeriod) submittedBucket.submitted += 1;

  const approvedBucket = trendLookup.get(
    bucketKeyForDate(approvedAt, period.granularity),
  );
  if (approvedBucket && approvedInPeriod) approvedBucket.approved += 1;

  const fundedBucket = trendLookup.get(
    bucketKeyForDate(fundedAt, period.granularity),
  );
  if (fundedBucket && fundedInPeriod) {
    fundedBucket.funded += 1;
    fundedBucket.fundedVolume += amount;
  }
}

function serializeCounters(counters) {
  const { uniqueLenderIds, productVolume, applicationsByStatus, ...rest } =
    counters;

  const topProducts = Array.from(productVolume.entries())
    .map(([product, totalApprovedAmount]) => ({
      product,
      totalApprovedAmount: Number(totalApprovedAmount) || 0,
    }))
    .filter((item) => item.totalApprovedAmount > 0)
    .sort((a, b) => b.totalApprovedAmount - a.totalApprovedAmount)
    .slice(0, 5);

  return {
    ...rest,
    uniqueLendersAccessed: uniqueLenderIds.size,
    applicationsByStatus,
    conversion: {
      submissionRate: percentage(rest.totalSubmitted, rest.totalApplications),
      approvalRate: percentage(rest.totalApproved, rest.totalSubmitted),
      fundingRate: percentage(
        applicationsByStatus.FUNDED || 0,
        rest.totalApproved,
      ),
    },
    productWiseApprovedVolume: topProducts,
  };
}

function createAnalyticsEngine(periodKey = "12m") {
  const period = resolvePeriod(periodKey);
  const previousPeriod = {
    ...period,
    start: period.previousStart,
    end: period.previousEnd,
  };
  const current = emptyCounters();
  const previous = emptyCounters();
  const trendBuckets = createTrendBuckets(period);
  const trendLookup = new Map(
    trendBuckets.map((bucket) => [bucket.key, bucket]),
  );

  return {
    period,
    previousPeriod,
    add(application) {
      accumulateApplication(current, application, period, trendLookup);
      accumulateApplication(previous, application, previousPeriod, null);
    },
    finalize() {
      const currentSerialized = serializeCounters(current);
      const previousSerialized = serializeCounters(previous);

      const comparisonFields = [
        "totalApplications",
        "totalSubmitted",
        "totalInReview",
        "totalApproved",
        "totalDeclined",
        "totalFunded",
        "totalVolumeFunded",
        "uniqueLendersAccessed",
      ];

      const comparison = Object.fromEntries(
        comparisonFields.map((field) => {
          const currentValue = currentSerialized[field] || 0;
          const previousValue = previousSerialized[field] || 0;
          return [
            field,
            {
              current: currentValue,
              previous: previousValue,
              changePercent: changePercent(currentValue, previousValue),
            },
          ];
        }),
      );

      return {
        ...currentSerialized,
        period: {
          key: period.key,
          start: period.start.toISOString(),
          end: period.end.toISOString(),
          granularity: period.granularity,
        },
        comparison,
        monthlyTrend: trendBuckets.map(({ key, ...bucket }) => bucket),
      };
    },
  };
}

function buildPeriodDashboardAnalytics(applications, periodKey = "12m") {
  const engine = createAnalyticsEngine(periodKey);
  for (const application of applications || []) {
    engine.add(application);
  }
  return engine.finalize();
}

module.exports = {
  PERIOD_PRESETS,
  ANALYTICS_APPLICATION_SELECT,
  resolvePeriod,
  createAnalyticsEngine,
  buildPeriodDashboardAnalytics,
};
