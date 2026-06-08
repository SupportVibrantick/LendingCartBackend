const { adminLogs } = require("../../../services/logger/contextLogger.js");

const PLACEHOLDER_CLIENT_NAMES = new Set([
  "Applicant",
  "Individual Applicant",
  "Unknown",
  "Client",
  "Customer",
  "N/A",
]);

function submissionFieldValue(fields, ...keys) {
  for (const field of fields || []) {
    const key = field.builderField?.fieldKey || field.fieldKey;
    if (!keys.includes(key)) continue;

    const raw = field.value;
    if (raw == null || raw === "") continue;

    if (typeof raw === "string") return raw.trim();
    if (typeof raw === "number") return String(raw);
    if (typeof raw === "object" && raw !== null) {
      if (typeof raw.value === "string" || typeof raw.value === "number") {
        return String(raw.value).trim();
      }
      return String(raw).trim();
    }

    return String(raw).trim();
  }

  return null;
}

function resolveLatestAppClientName(app) {
  const contact =
    app.client?.contacts?.find((row) => row.isPrimary) ||
    app.client?.contacts?.[0];

  const fields = app.submissions?.[0]?.fields || [];

  const fromContact = [contact?.firstName, contact?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const fromFields = [
    submissionFieldValue(fields, "borrowerFirstName", "firstName", "first_name"),
    submissionFieldValue(fields, "borrowerLastName", "lastName", "last_name"),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const singleName = submissionFieldValue(
    fields,
    "borrowerName",
    "applicantName",
    "fullName",
    "name",
  );

  const legalName = app.client?.legalName?.trim();

  if (fromContact && !PLACEHOLDER_CLIENT_NAMES.has(fromContact)) return fromContact;
  if (fromFields && !PLACEHOLDER_CLIENT_NAMES.has(fromFields)) return fromFields;
  if (singleName && !PLACEHOLDER_CLIENT_NAMES.has(singleName)) return singleName;
  if (legalName && !PLACEHOLDER_CLIENT_NAMES.has(legalName)) return legalName;

  return fromContact || fromFields || singleName || legalName || null;
}

function resolveLatestAppAmount(app) {
  const fields = app.submissions?.[0]?.fields || [];

  const fromSubmission = submissionFieldValue(
    fields,
    "amountRequested",
    "loanAmount",
    "requestedAmount",
    "loan_amount",
  );

  if (fromSubmission) {
    const parsed = Number(String(fromSubmission).replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }

  if (app.amountRequested != null) {
    const direct = Number(app.amountRequested);
    if (!Number.isNaN(direct) && direct > 0) return direct;
  }

  return null;
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function adminStatsRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Dashboard Stats"],
        summary: "Get Complete Admin Analytics Dashboard",
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const now = new Date();
        const last7Days = new Date();
        last7Days.setDate(now.getDate() - 7);

        const last30Days = new Date();
        last30Days.setDate(now.getDate() - 30);

        const [
          // ORGANIZATIONS
          totalOrganizations,
          orgByType,

          // USERS
          totalUsers,
          activeUsers,

          // CLIENTS
          totalClients,
          activeClients,

          // APPLICATIONS
          totalApplications,
          applicationStatusCounts,
          fundedVolume,

          applicationsLast7Days,
          applicationsLast30Days,

          // LENDER
          totalLenderProducts,
          totalApplicationLenders,
          lenderStatusCounts,
          totalLenderReviews,
          conditionalApprovals,

          // RULE ENGINE
          totalRuleEvaluations,
          failedRules,

          // DOCUMENTS
          totalDocumentUploads,

          // RELATIONSHIPS
          activeBrokerLenderLinks,

          // LEADS
          totalClmLeads,
          totalLandingLeads,
          totalAdminLeads,

          // 🔥 LATEST APPLICATIONS
          latestApplications,

          totalLoanOfficers,
          totalSubBrokers,
          totalConversations,

        ] = await Promise.all([

          // ORGANIZATIONS
          prisma.organization.count({ where: { isDeleted: false } }),
          prisma.organization.groupBy({
            by: ["type"],
            _count: true,
          }),

          // USERS
          prisma.userAccount.count({ where: { isDeleted: false } }),
          prisma.userAccount.count({ where: { status: "ACTIVE", isDeleted: false } }),

          // CLIENTS
          prisma.client.count({ where: { isDeleted: false } }),
          prisma.client.count({ where: { isActive: true, isDeleted: false } }),

          // APPLICATIONS
          prisma.loanApplication.count(),
          prisma.loanApplication.groupBy({
            by: ["status"],
            _count: true,
          }),

          prisma.loanApplication.aggregate({
            _sum: {
              amountRequested: true,
            },
            where: { status: "FUNDED" },
          }),

          prisma.loanApplication.count({ where: { createdAt: { gte: last7Days } } }),
          prisma.loanApplication.count({ where: { createdAt: { gte: last30Days } } }),

          // LENDER
          prisma.lenderProduct.count({ where: { isActive: true } }),
          prisma.applicationLender.count(),
          prisma.applicationLender.groupBy({
            by: ["status"],
            _count: true,
          }),
          prisma.lenderReview.count(),
          prisma.lenderReview.count({ where: { reviewStatus: "CONDITIONAL" } }),

          // RULE ENGINE
          prisma.applicationRuleEvaluation.count(),
          prisma.applicationRuleResult.count({ where: { passed: false } }),

          // DOCUMENTS
          prisma.applicationDocumentUpload.count(),

          // RELATIONSHIPS
          prisma.brokerLenderAccess.count({ where: { isActive: true } }),

          // LEADS
          prisma.commercialLendingMasteryLead.count(),
          prisma.clmLandingPageLead.count(),
          prisma.adminManualLead.count(),

          // 🔥 LATEST APPLICATIONS (Top 10)
          prisma.loanApplication.findMany({
            take: 10,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              applicationNumber: true,
              status: true,
              loanProductCode: true,
              amountRequested: true,
              createdAt: true,
              brokerOrg: { select: { name: true } },
              client: {
                select: {
                  legalName: true,
                  contacts: {
                    orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
                    select: {
                      firstName: true,
                      lastName: true,
                      isPrimary: true,
                    },
                  },
                },
              },
              submissions: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: {
                  fields: {
                    include: {
                      builderField: { select: { fieldKey: true } },
                    },
                  },
                },
              },
              applicationLenders: {
                select: {
                  id: true,
                  lender: { select: { name: true } },
                },
              },
            },
          }),

          prisma.userAccount.count({
            where: {
              isDeleted: false,
              roles: { some: { role: { name: "BROKER_OFFICER" } } },
            },
          }),
          prisma.userAccount.count({
            where: {
              isDeleted: false,
              roles: { some: { role: { name: "SUB_BROKER" } } },
            },
          }),
          prisma.conversation.count(),
        ]);

        adminLogs.info("Improved full admin dashboard analytics fetched");

        return reply.status(200).send({
          success: true,
          data: {

            organizations: {
              total: totalOrganizations,
              breakdown: orgByType,
            },

            users: {
              total: totalUsers,
              active: activeUsers,
              loanOfficers: totalLoanOfficers,
              subBrokers: totalSubBrokers,
            },

            conversations: {
              total: totalConversations,
            },

            clients: {
              total: totalClients,
              active: activeClients,
            },

            applications: {
              total: totalApplications,
              breakdown: applicationStatusCounts,
              fundedVolume: fundedVolume._sum.amountRequested || 0,
              last7Days: applicationsLast7Days,
              last30Days: applicationsLast30Days,
            },

            lenders: {
              products: totalLenderProducts,
              connections: totalApplicationLenders,
              breakdown: lenderStatusCounts,
              reviews: totalLenderReviews,
              conditionalApprovals,
            },

            ruleEngine: {
              totalEvaluations: totalRuleEvaluations,
              failedRules,
            },

            documents: {
              totalUploads: totalDocumentUploads,
            },

            relationships: {
              activeBrokerLenderLinks,
            },

            leads: {
              commercialMastery: totalClmLeads,
              landingPage: totalLandingLeads,
              adminManual: totalAdminLeads,
            },

            latestApplications: latestApplications.map((app) => ({
              id: app.id,
              applicationNumber: app.applicationNumber,
              status: app.status,
              product: app.loanProductCode,
              amount: resolveLatestAppAmount(app),
              brokerName: app.brokerOrg?.name || null,
              clientName: resolveLatestAppClientName(app),
              lenderCount: app.applicationLenders.length,
              lenderNames: app.applicationLenders
                .map((row) => row.lender?.name)
                .filter(Boolean),
              createdAt: app.createdAt,
            })),
          },
        });

      } catch (error) {
        adminLogs.error("Fetching full admin stats failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while retrieving statistics",
          details:
            process.env.NODE_ENV === "development"
              ? error.message
              : undefined,
        });
      }
    }
  );
}

module.exports = adminStatsRoutes;