const prisma = require("../../../config/prisma");
const {
  resolveClientDisplayNameFromData,
} = require("../../../services/messaging/resolveClientDisplayName");
const {
  buildBrokerPipelineApplicationStatusWhere,
  resolveBrokerPipelineDisplayStatus,
} = require("../../../utils/applications/resolveApplicationStatus");
const {
  buildEnrichedApplicationSearchWhere,
} = require("../../../services/applications/loanApplicationSearch");

async function getApplicationsRoute(fastify, options) {
  fastify.get(
    "/",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
    },

    async (request, reply) => {
      try {
        const userId = request.user.userId;

        /* ===============================
           QUERY PARAMS
        =============================== */

        const page = Math.max(1, Number(request.query.page) || 1);

        const limit = Math.max(1, Number(request.query.limit) || 10);

        const search = String(request.query.search || "").trim();

        const statusFilter = String(request.query.status || "")
          .trim()
          .toUpperCase();

        const skip = Math.max(0, (page - 1) * limit);

        const pipelineStatusFilters = [
          "DRAFT",
          "SUBMITTED",
          "IN_REVIEW",
          "CLIENT_PENDING",
          "APPROVED",
          "DECLINED",
        ];

        /* ===============================
   SEARCH FILTER
=============================== */

        const OR = search
          ? await buildEnrichedApplicationSearchWhere(prisma, search, {
              includeBorrower: true,
              includeAssignedStaff: true,
              includeSubmissionFields: true,
            })
          : [];

        /* ===============================
           WHERE
        =============================== */

        const pipelineStatusWhere = buildBrokerPipelineApplicationStatusWhere(
          pipelineStatusFilters.includes(statusFilter) ? statusFilter : undefined,
        );

        const where = {
          subBrokerAssignments: {
            some: {
              subBrokerId: userId,
            },
          },

          ...pipelineStatusWhere,

          ...(OR.length > 0 && {
            OR,
          }),
        };

        /* ===============================
           TOTAL COUNT
        =============================== */

        const total = await prisma.loanApplication.count({
          where,
        });

        /* ===============================
           GET APPLICATIONS
        =============================== */

        const applications = await prisma.loanApplication.findMany({
          where,

          skip,

          take: limit,

          orderBy: {
            createdAt: "desc",
          },

          select: {
            id: true,

            applicationNumber: true,

            amountRequested: true,

            purpose: true,

            status: true,

            createdAt: true,

            updatedAt: true,

            submittedAt: true,

            loanProductCode: true,

            termMonthsRequested: true,

            brokerUser: {
              select: {
                id: true,

                firstName: true,

                lastName: true,

                email: true,

                profileImage: true,

                roles: {
                  select: {
                    role: {
                      select: { name: true },
                    },
                  },
                },
              },
            },

            loanOfficerAssignments: {
              select: {
                loanOfficer: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    profileImage: true,
                  },
                },
              },
              orderBy: { assignedAt: "asc" },
            },

            client: {
              select: {
                id: true,

                legalName: true,

                entityType: true,

                industry: true,

                contacts: {
                  orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    isPrimary: true,
                  },
                },
              },
            },

            submissions: {
              where: { status: { not: "SUPERSEDED" } },

              orderBy: {
                createdAt: "desc",
              },

              take: 1,

              select: {
                id: true,

                status: true,

                createdAt: true,

                fields: {
                  select: {
                    fieldKey: true,

                    value: true,
                  },
                },
              },
            },

            applicationLenders: {
              select: {
                id: true,

                lenderOrgId: true,

                status: true,

                sentAt: true,

                lender: {
                  select: {
                    id: true,

                    name: true,
                  },
                },
              },
            },

            subBrokerAssignments: {
              select: {
                assignedAt: true,

                assignedBy: {
                  select: {
                    firstName: true,

                    lastName: true,

                    email: true,
                  },
                },
              },
            },
          },
        });

        /* ===============================
           FORMAT RESPONSE
        =============================== */

        const formatted = applications.map((item) => {
          const latestSubmission = item.submissions?.[0];

          const fieldsMap = {};

          latestSubmission?.fields?.forEach((field) => {
            fieldsMap[field.fieldKey] = field.value;
          });

          const submissions = latestSubmission
            ? [
                {
                  fields: (latestSubmission.fields || []).map((field) => ({
                    fieldKey: field.fieldKey,
                    value: field.value,
                  })),
                },
              ]
            : [];

          const borrowerName = resolveClientDisplayNameFromData(
            item.client,
            submissions,
          );

          const formatPerson = (user) =>
            user
              ? {
                  id: user.id,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  email: user.email,
                  profileImage: user.profileImage,
                  name: `${user.firstName || ""} ${
                    user.lastName || ""
                  }`.trim(),
                }
              : null;

          const assignedFromJoin =
            item.loanOfficerAssignments
              ?.map((row) => formatPerson(row.loanOfficer))
              .filter(Boolean) || [];

          const primaryOfficer = item.brokerUser
            ? formatPerson(item.brokerUser)
            : null;

          const assignedLoanOfficers = assignedFromJoin.length
            ? assignedFromJoin
            : primaryOfficer
              ? [primaryOfficer]
              : [];

          return {
            submissionId: latestSubmission?.id || item.id,

            applicationId: item.id,

            borrower: borrowerName,

            applicationNumber: item.applicationNumber || "-",

            loanInfo:
              fieldsMap.loanProductCode ||
              item.loanProductCode ||
              fieldsMap.purpose ||
              item.purpose ||
              "N/A",

            location:
              [
                fieldsMap.propertyCity,

                fieldsMap.propertyState,

                fieldsMap.propertyCountry,
              ]
                .filter(Boolean)
                .join(", ") || "N/A",

            amount: Number(
              fieldsMap.amountRequested || item.amountRequested || 0,
            ),

            purpose: fieldsMap.purpose || item.purpose || null,

            propertyCity: fieldsMap.propertyCity || null,

            propertyState: fieldsMap.propertyState || null,

            propertyCountry: fieldsMap.propertyCountry || null,

            loanProductCode:
              fieldsMap.loanProductCode || item.loanProductCode || null,

            termMonthsRequested:
              fieldsMap.termMonthsRequested || item.termMonthsRequested || null,

            status: resolveBrokerPipelineDisplayStatus(item),

            submittedOn: item.submittedAt || item.createdAt,

            submissionStatus: latestSubmission?.status || null,

            dynamicFields: fieldsMap,

            assignedLoanOfficer: assignedLoanOfficers[0] || null,

            assignedLoanOfficers,

            submittedToLenders: item.applicationLenders.map((lender) => ({
              lenderOrgId: lender.lenderOrgId,

              lenderName: lender.lender?.name || null,

              status: lender.status,

              sentAt: lender.sentAt,
            })),

            assignedBy: item.subBrokerAssignments?.[0]?.assignedBy || null,

            assignedAt: item.subBrokerAssignments?.[0]?.assignedAt || null,
          };
        });

        /* ===============================
           PAGINATION
        =============================== */

        const totalPages = Math.ceil(total / limit) || 1;

        const hasNextPage = page < totalPages;

        const hasPreviousPage = page > 1;

        /* ===============================
           SUCCESS RESPONSE
        =============================== */

        return reply.send({
          success: true,

          data: formatted,

          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNextPage,
            hasPreviousPage,
          },
        });
      } catch (err) {
        console.error(err);

        return reply.code(500).send({
          success: false,

          message: err.message || "Something went wrong",
        });
      }
    },
  );
}

module.exports = getApplicationsRoute;
