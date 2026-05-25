const {
  consolidateApplicationLenders,
  extractRequestedAmount,
  percentage,
} = require("./dashboardAnalytics");

function getFieldValue(fields = [], ...keys) {
  return fields.find((field) =>
    keys.includes(field.fieldKey),
  )?.value;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function resolveBorrowerName(app) {
  const contact =
    app?.client?.contacts?.[0] || null;
  const fields =
    app?.submissions?.[0]?.fields || [];
  const borrowerFirstName =
    normalizeText(
      getFieldValue(
        fields,
        "borrowerFirstName",
        "firstName",
        "first_name",
      ),
    );
  const borrowerLastName =
    normalizeText(
      getFieldValue(
        fields,
        "borrowerLastName",
        "lastName",
        "last_name",
      ),
    );
  const fullNameFromFields = [
    borrowerFirstName,
    borrowerLastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const clientLegalName = normalizeText(
    app?.client?.legalName,
  );

  return (
    [contact?.firstName, contact?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    fullNameFromFields ||
    normalizeText(
      getFieldValue(
        fields,
        "borrowerName",
        "applicantName",
        "fullName",
        "name",
      ),
    ) ||
    (clientLegalName &&
    ![
      "Applicant",
      "Individual Applicant",
    ].includes(clientLegalName)
      ? clientLegalName
      : null) ||
    "N/A"
  );
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports =
  async function getPipelinePerformance(
    fastify,
  ) {
    fastify.get(
      "/",
      async (req, reply) => {
        try {
          /* ===============================
             AUTH CHECK
          =============================== */
          if (
            !req.user ||
            req.user.orgType !==
              "LENDER"
          ) {
            return reply
              .code(403)
              .send({
                success: false,
                message:
                  "Lender access only",
              });
          }

          const lenderOrgId =
            req.user.organizationId;

          const today = new Date();
          const trendStart = new Date(
            today.getFullYear(),
            today.getMonth() - 5,
            1,
          );

          const applicationLenders =
            await fastify.prisma.applicationLender.findMany(
              {
                where: {
                  lenderOrgId,
                },
                select: {
                  id: true,
                  loanApplicationId: true,
                  lenderProductId: true,
                  status: true,
                  sentAt: true,
                  lastUpdatedAt: true,
                  lenderProduct: {
                    select: {
                      loanProductCode: true,
                    },
                  },
                  loanApplication: {
                    select: {
                      id: true,
                      applicationNumber: true,
                      status: true,
                      amountRequested: true,
                      loanProductCode: true,
                      createdAt: true,
                      brokerOrgId: true,
                      brokerOrg: {
                        select: {
                          name: true,
                        },
                      },
                      client: {
                        select: {
                          legalName: true,
                          contacts: {
                            take: 1,
                            orderBy: [
                              {
                                isPrimary: "desc",
                              },
                              {
                                id: "asc",
                              },
                            ],
                            select: {
                              firstName: true,
                              lastName: true,
                            },
                          },
                        },
                      },
                      submissions: {
                        take: 1,
                        orderBy: {
                          createdAt: "desc",
                        },
                        select: {
                          fields: {
                            select: {
                              fieldKey: true,
                              value: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            );

          const applications =
            consolidateApplicationLenders(
              applicationLenders,
            );

          /* ===============================
             COUNTS
          =============================== */

          const totalApplications =
            applications.length;

          const totalSubmitted =
            applications.filter(
              (a) =>
                [
                  "IN_REVIEW",
                  "APPROVED",
                  "DECLINED",
                  "FUNDED",
                  "SENT",
                ].includes(
                  a.effectiveStatus,
                ),
            ).length;

          const totalInReview =
            applications.filter(
              (a) =>
                a.effectiveStatus ===
                "IN_REVIEW",
            ).length;

          const totalApproved =
            applications.filter(
              (a) =>
                a.effectiveStatus ===
                  "APPROVED" ||
                a.effectiveStatus ===
                  "FUNDED",
            ).length;

          const totalFunded =
            applications.filter(
              (a) =>
                a.effectiveStatus ===
                "FUNDED",
            ).length;

          /* ===============================
             CONVERSIONS
          =============================== */

          const approvalRate = percentage(
            totalApproved,
            totalSubmitted,
            1,
          );

          const fundingConversion =
            percentage(
              totalFunded,
              totalApproved,
              1,
            );

          const submittedConversion =
            percentage(
              totalSubmitted,
              totalApplications,
              1,
            );

          const reviewConversion =
            percentage(
              totalInReview,
              totalSubmitted,
              1,
            );

          const stageBreakdownOrder = [
            "SENT",
            "IN_REVIEW",
            "APPROVED",
            "FUNDED",
            "DECLINED",
            "WITHDRAWN",
          ];

          const stageLabels = {
            SENT: "Sent",
            IN_REVIEW: "In Review",
            APPROVED: "Approved",
            FUNDED: "Funded",
            DECLINED: "Declined",
            WITHDRAWN: "Withdrawn",
          };

          const stageBreakdown =
            stageBreakdownOrder.map(
              (status) => ({
                status,
                label:
                  stageLabels[status],
                count: applications.filter(
                  (item) =>
                    item.effectiveStatus ===
                    status,
                ).length,
              }),
            );

          const monthBuckets = [];

          for (let index = 0; index < 6; index += 1) {
            const bucketDate =
              new Date(
                today.getFullYear(),
                today.getMonth() -
                  (5 - index),
                1,
              );

            monthBuckets.push({
              key: `${bucketDate.getFullYear()}-${String(
                bucketDate.getMonth() + 1,
              ).padStart(2, "0")}`,
              label:
                bucketDate.toLocaleString(
                  "en-US",
                  {
                    month: "short",
                  },
                ),
              applications: 0,
              approved: 0,
              funded: 0,
              fundedVolume: 0,
            });
          }

          const monthIndexMap = new Map(
            monthBuckets.map(
              (bucket, index) => [
                bucket.key,
                index,
              ],
            ),
          );

          const brokerMetrics =
            new Map();
          const productMetrics =
            new Map();

          for (const application of applications) {
            const activityDate =
              application.activityAt
                ? new Date(
                    application.activityAt,
                  )
                : null;

            if (
              activityDate &&
              activityDate >= trendStart
            ) {
              const monthKey = `${activityDate.getFullYear()}-${String(
                activityDate.getMonth() + 1,
              ).padStart(2, "0")}`;
              const bucketIndex =
                monthIndexMap.get(
                  monthKey,
                );

              if (
                bucketIndex !==
                undefined
              ) {
                const bucket =
                  monthBuckets[
                    bucketIndex
                  ];

                bucket.applications += 1;

                if (
                  [
                    "APPROVED",
                    "FUNDED",
                  ].includes(
                    application.effectiveStatus,
                  )
                ) {
                  bucket.approved += 1;
                }

                if (
                  application.effectiveStatus ===
                  "FUNDED"
                ) {
                  bucket.funded += 1;
                  bucket.fundedVolume +=
                    Number(
                      application.amountRequested ||
                        0,
                    );
                }
              }
            }

            const brokerId =
              application
                .loanApplication
                ?.brokerOrgId ||
              "unknown";
            const brokerName =
              application
                .loanApplication
                ?.brokerOrg
                ?.name ||
              "Unknown Broker";
            const brokerEntry =
              brokerMetrics.get(
                brokerId,
              ) || {
                brokerOrgId: brokerId,
                brokerName,
                applications: 0,
                approved: 0,
                funded: 0,
              };

            brokerEntry.applications += 1;

            if (
              [
                "APPROVED",
                "FUNDED",
              ].includes(
                application.effectiveStatus,
              )
            ) {
              brokerEntry.approved += 1;
            }

            if (
              application.effectiveStatus ===
              "FUNDED"
            ) {
              brokerEntry.funded += 1;
            }

            brokerMetrics.set(
              brokerId,
              brokerEntry,
            );

            const productCode =
              application
                .lenderProduct
                ?.loanProductCode ||
              application
                .loanApplication
                ?.loanProductCode ||
              "UNKNOWN";
            const productEntry =
              productMetrics.get(
                productCode,
              ) || {
                productCode,
                applications: 0,
                approved: 0,
                funded: 0,
              };

            productEntry.applications += 1;

            if (
              [
                "APPROVED",
                "FUNDED",
              ].includes(
                application.effectiveStatus,
              )
            ) {
              productEntry.approved += 1;
            }

            if (
              application.effectiveStatus ===
              "FUNDED"
            ) {
              productEntry.funded += 1;
            }

            productMetrics.set(
              productCode,
              productEntry,
            );
          }

          const monthlyTrend =
            monthBuckets.map(
              (bucket) => ({
                ...bucket,
                fundedVolume: Number(
                  bucket.fundedVolume.toFixed(
                    2,
                  ),
                ),
              }),
            );

          const brokerPerformance =
            Array.from(
              brokerMetrics.values(),
            )
              .map((entry) => ({
                ...entry,
                approvalRate:
                  percentage(
                    entry.approved,
                    entry.applications,
                    1,
                  ),
              }))
              .sort(
                (a, b) =>
                  b.applications -
                  a.applications,
              )
              .slice(0, 5);

          const productMix =
            Array.from(
              productMetrics.values(),
            )
              .map((entry) => ({
                ...entry,
                approvalRate:
                  percentage(
                    entry.approved,
                    entry.applications,
                    1,
                  ),
              }))
              .sort(
                (a, b) =>
                  b.applications -
                  a.applications,
              );

          const recentApplications =
            [...applications]
              .sort((a, b) => {
                const aTime =
                  new Date(
                    a.activityAt || 0,
                  ).getTime();
                const bTime =
                  new Date(
                    b.activityAt || 0,
                  ).getTime();

                return bTime - aTime;
              })
              .slice(0, 6)
              .map((item) => ({
                applicationLenderId:
                  item.id,
                applicationId:
                  item.loanApplication
                    ?.id || null,
                applicationNumber:
                  item.loanApplication
                    ?.applicationNumber ||
                  "N/A",
                clientName:
                  resolveBorrowerName(
                    item.loanApplication,
                  ),
                brokerName:
                  item.loanApplication
                    ?.brokerOrg?.name ||
                  "Unknown Broker",
                productCode:
                  item.lenderProduct
                    ?.loanProductCode ||
                  item.loanApplication
                    ?.loanProductCode ||
                  "UNKNOWN",
                amountRequested:
                  extractRequestedAmount(
                    item.loanApplication,
                  ),
                pipelineStatus:
                  item.effectiveStatus,
                sentAt: item.sentAt,
                updatedAt:
                  item.lastUpdatedAt,
              }));

          /* ===============================
             RESPONSE
          =============================== */

          return reply.send({
            success: true,

            data: {
              totalApplications,
              totalSubmitted,
              totalInReview,
              totalApproved,
              totalFunded,

              approvalRate,
              fundingConversion,
              submittedConversion,
              reviewConversion,

              stageBreakdown,
              monthlyTrend,
              brokerPerformance,
              productMix,
              recentApplications,
            },
          });
        } catch (error) {
          fastify.log.error({
            route:
              "lender-pipeline-performance",

            error:
              error.message,

            stack:
              error.stack,
          });

          return reply
            .code(500)
            .send({
              success: false,
              message:
                error.message || "Failed to fetch pipeline performance",
            });
        }
      },
    );
  };
