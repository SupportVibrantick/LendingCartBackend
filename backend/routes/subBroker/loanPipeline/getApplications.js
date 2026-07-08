const prisma = require("../../../config/prisma");
const {
  resolveClientDisplayNameFromData,
} = require("../../../services/messaging/resolveClientDisplayName");
const {
  buildBrokerPipelineApplicationStatusWhere,
  resolveBrokerPipelineDisplayStatus,
} = require("../../../utils/applications/resolveApplicationStatus");

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

        /* ===============================
           VALID ENUMS
        =============================== */

        const validLoanProducts = [
          "PURCHASE_ORDER_FINANCE",

          "SBA_7A_EQUIPMENT_PURCHASE",

          "SBA_504_REAL_ESTATE_EQUIPMENT",

          "WORKING_CAPITAL",

          "TERM_LOAN",

          "LINE_OF_CREDIT",
        ];

        const validLoanApplicationStatuses = [
          "DRAFT",
          "SUBMITTED",
          "IN_REVIEW",
          "AUTO_APPROVED",
          "AUTO_DECLINED",
          "LENDER_SELECTED",
          "LENDER_APPROVED",
          "LENDER_DECLINED",
          "FUNDED",
          "WITHDRAWN",
          "CLIENT_PENDING",
          "SUSPENDED",
        ];

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

        const OR = [];

        if (search) {
          const upperSearch = search.toUpperCase();

          /* APPLICATION NUMBER */
          OR.push({
            applicationNumber: {
              contains: search,
              mode: "insensitive",
            },
          });

          /* PURPOSE */
          OR.push({
            purpose: {
              contains: search,
              mode: "insensitive",
            },
          });

          /* CLIENT LEGAL NAME */
          OR.push({
            client: {
              is: {
                legalName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          });

          /* LOAN PRODUCT ENUM */
          if (validLoanProducts.includes(upperSearch)) {
            OR.push({
              loanProductCode: upperSearch,
            });
          }

          /* STATUS ENUM */
          if (validLoanApplicationStatuses.includes(upperSearch)) {
            OR.push({
              status: upperSearch,
            });
          }

          if (upperSearch === "APPROVED" || upperSearch === "DECLINED") {
            OR.push(buildBrokerPipelineApplicationStatusWhere(upperSearch));
          }

          /* SEARCH INSIDE FIELD KEYS */

          OR.push({
            submissions: {
              some: {
                fields: {
                  some: {
                    fieldKey: {
                      contains: search,
                    },
                  },
                },
              },
            },
          });
        }

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
                firstName: true,

                lastName: true,

                email: true,

                profileImage: true,
              },
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

            assignedLoanOfficer: item.brokerUser
              ? {
                  firstName: item.brokerUser.firstName,

                  lastName: item.brokerUser.lastName,

                  email: item.brokerUser.email,

                  profileImage: item.brokerUser.profileImage,
                }
              : null,

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
