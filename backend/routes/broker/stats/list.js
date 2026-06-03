// backend/routes/broker/stats/list.js

const MONTH_WINDOW = 6;

function parseAmount(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentage(numerator, denominator, precision = 1) {
  if (!denominator) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(precision));
}

function createMonthBuckets() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });

  return Array.from({ length: MONTH_WINDOW }, (_, index) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCMonth(date.getUTCMonth() - (MONTH_WINDOW - 1 - index));

    return {
      key: `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1,
      ).padStart(2, "0")}`,
      label: formatter.format(date),
      applications: 0,
      submitted: 0,
      approved: 0,
      funded: 0,
      fundedVolume: 0,
    };
  });
}

function getMonthKey(dateValue) {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

function isSubmittedApplication(application) {
  if (application?.submittedAt) {
    return true;
  }

  return !["DRAFT", "CLIENT_PENDING"].includes(application?.status);
}

function isApprovedApplication(application) {
  if (!application) {
    return false;
  }

  if (["LENDER_APPROVED", "FUNDED", "AUTO_APPROVED"].includes(application.status)) {
    return true;
  }

  return application.applicationLenders?.some((lender) => lender.status === "APPROVED");
}

function isDeclinedApplication(application) {
  if (!application) {
    return false;
  }

  if (["LENDER_DECLINED", "AUTO_DECLINED"].includes(application.status)) {
    return true;
  }

  return (
    application.applicationLenders?.length > 0 &&
    application.applicationLenders.every((lender) => lender.status === "DECLINED")
  );
}

module.exports = async function brokerStatsList(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Stats"],
        summary: "Get broker dashboard statistics",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const userId = req.user.id || req.user.userId;
        const roles = req.user.roles || [];

        const isAdmin = roles.includes("BROKER_ADMIN");
        const isOfficer = roles.includes("BROKER_OFFICER");
        const isSubBroker = roles.includes("SUB_BROKER");

        if (!isAdmin && !isOfficer && !isSubBroker) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        if (!brokerOrgId) {
          return reply.code(400).send({
            success: false,
            message: "Invalid broker organization",
          });
        }

        const applicationWhere = {
          brokerOrgId,

          ...(isOfficer && {
            brokerUserId: userId,
          }),

          ...(isSubBroker && {
            subBrokerAssignments: {
              some: {
                subBrokerId: userId,
              },
            },
          }),
        };

        const [applications, uniqueLenders] = await Promise.all([
          prisma.loanApplication.findMany({
            where: applicationWhere,
            select: {
              id: true,
              status: true,
              amountRequested: true,
              loanProductCode: true,
              createdAt: true,
              updatedAt: true,
              submittedAt: true,
              applicationLenders: {
                select: {
                  status: true,
                },
              },
            },
          }),
          prisma.applicationLender.findMany({
            where: {
              loanApplication: applicationWhere,
            },
            distinct: ["lenderOrgId"],
            select: {
              lenderOrgId: true,
            },
          }),
        ]);

        const monthlyBuckets = createMonthBuckets();
        const monthlyLookup = new Map(
          monthlyBuckets.map((bucket) => [bucket.key, bucket]),
        );

        const productVolume = new Map();

        let totalSubmitted = 0;
        let totalInReview = 0;
        let totalApproved = 0;
        let totalDeclined = 0;
        let totalFunded = 0;
        let totalWithdrawn = 0;
        let totalVolumeFunded = 0;
        const statusBreakdown = {
          DRAFT: 0,
          CLIENT_PENDING: 0,
          SUBMITTED: 0,
          IN_REVIEW: 0,
          LENDER_APPROVED: 0,
          LENDER_DECLINED: 0,
          FUNDED: 0,
          WITHDRAWN: 0,
        };

        for (const application of applications) {
          const amount = parseAmount(application.amountRequested);
          const submitted = isSubmittedApplication(application);
          const approved = isApprovedApplication(application);
          const declined = isDeclinedApplication(application);
          const funded = application.status === "FUNDED";
          const withdrawn = application.status === "WITHDRAWN";
          const inReview =
            application.status === "IN_REVIEW" ||
            application.applicationLenders?.some((lender) => lender.status === "IN_REVIEW");

          if (submitted) {
            totalSubmitted += 1;
          }

          if (inReview) {
            totalInReview += 1;
          }

          if (approved) {
            totalApproved += 1;
          }

          if (declined) {
            totalDeclined += 1;
          }

          if (funded) {
            totalFunded += 1;
            totalVolumeFunded += amount;
          }

          if (withdrawn) {
            totalWithdrawn += 1;
          }

          let currentStage = "DRAFT";

          if (withdrawn) {
            currentStage = "WITHDRAWN";
          } else if (funded) {
            currentStage = "FUNDED";
          } else if (declined) {
            currentStage = "LENDER_DECLINED";
          } else if (approved) {
            currentStage = "LENDER_APPROVED";
          } else if (inReview) {
            currentStage = "IN_REVIEW";
          } else if (application.status === "CLIENT_PENDING") {
            currentStage = "CLIENT_PENDING";
          } else if (submitted) {
            currentStage = "SUBMITTED";
          }

          statusBreakdown[currentStage] += 1;

          if (approved || funded) {
            const existingAmount = productVolume.get(application.loanProductCode) || 0;
            productVolume.set(application.loanProductCode, existingAmount + amount);
          }

          const createdBucket = monthlyLookup.get(getMonthKey(application.createdAt));
          if (createdBucket) {
            createdBucket.applications += 1;
          }

          const submittedBucket = monthlyLookup.get(
            getMonthKey(application.submittedAt || application.createdAt),
          );
          if (submitted && submittedBucket) {
            submittedBucket.submitted += 1;
          }

          const approvedBucket = monthlyLookup.get(getMonthKey(application.updatedAt));
          if (approved && approvedBucket) {
            approvedBucket.approved += 1;
          }

          const fundedBucket = monthlyLookup.get(getMonthKey(application.updatedAt));
          if (funded && fundedBucket) {
            fundedBucket.funded += 1;
            fundedBucket.fundedVolume += amount;
          }
        }

        const totalApplications = applications.length;
        const topProducts = Array.from(productVolume.entries())
          .map(([product, totalApprovedAmount]) => ({
            product,
            totalApprovedAmount,
          }))
          .sort((a, b) => b.totalApprovedAmount - a.totalApprovedAmount)
          .slice(0, 5);

        return reply.send({
          success: true,
          data: {
            totalApplications,
            totalSubmitted,
            totalInReview,
            totalApproved,
            totalDeclined,
            totalFunded,
            totalWithdrawn,
            totalVolumeFunded,
            uniqueLendersAccessed: uniqueLenders.length,

            applicationsByStatus: statusBreakdown,

            conversion: {
              submissionRate: percentage(totalSubmitted, totalApplications),
              approvalRate: percentage(totalApproved, totalSubmitted),
              fundingRate: percentage(totalFunded, totalApproved),
            },

            monthlyTrend: monthlyBuckets.map(({ key, ...bucket }) => bucket),
            productWiseApprovedVolume: topProducts,
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            brokerOrgId: req.user?.organizationId,
          },
          "Broker stats fetch failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error while fetching broker stats",
        });
      }
    },
  );
};
