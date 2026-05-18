/**
 * @param {import("fastify").FastifyInstance} fastify
 */

const validStatuses = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "CLIENT_PENDING",
  "APPROVED",
  "DECLINED",
  "COMPLETED",
];

module.exports = async function listSubmissionsTable(fastify) {
  fastify.get(
    "/submissions",
    { preHandler: fastify.authenticate },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= AUTH ================= */

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const userId = req.user.id || req.user.userId;
        const orgId = req.user.organizationId;
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

        /* ================= QUERY PARAMS ================= */

        const {
          cursor,
          limit = 10,
          search,
          status,
          sortBy = "createdAt",
          sortOrder = "desc",
        } = req.query;

        const parsedLimit = Math.min(parseInt(limit) || 10, 50);

        /* ================= WHERE ================= */

        const whereCondition = {
          application: {
            brokerOrgId: orgId,

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

            ...(search && {
              OR: [
                {
                  applicationNumber: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  client: {
                    is: {
                      legalName: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            }),
          },

          ...(validStatuses.includes(status) && {
            status,
          }),
        };

        /* ================= QUERY ================= */

        const allowedSortFields = ["createdAt", "updatedAt", "status"];

        const safeSortBy = allowedSortFields.includes(sortBy)
          ? sortBy
          : "createdAt";

        const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";

        const submissions = await prisma.applicationSubmission.findMany({
          where: whereCondition,
          take: parsedLimit,

          ...(cursor && {
            skip: 1,
            cursor: { id: cursor },
          }),

          orderBy: {
            [safeSortBy]: safeSortOrder,
          },

          include: {
            fields: {
              include: {
                builderField: true,
              },
            },

            application: {
              select: {
                id: true,
                applicationNumber: true,
                loanProductCode: true,
                amountRequested: true,
                status: true,
                brokerUserId: true,

                client: {
                  select: {
                    legalName: true,
                    contacts: {
                      select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                      },
                      take: 1,
                    },
                  },
                },

                documentRequirements: {
                  select: { status: true },
                },

                brokerUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    profileImage: true,
                  },
                },

                applicationLenders: {
                  select: {
                    lenderOrgId: true,
                    status: true,
                    sentAt: true,
                    lender: {
                      select: {
                        name: true,
                        users: {
                          select: { profileImage: true },
                          take: 1,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        /* ================= PAGINATION ================= */

        const nextCursor =
          submissions.length === parsedLimit
            ? submissions[submissions.length - 1].id
            : null;

        /* ================= TRANSFORM ================= */

        const data = submissions.map((s) => {
          const app = s.application;

          const contact =
  app?.client?.contacts?.[0];

const getFieldValue = (...keys) =>
  s.fields.find((f) =>
    keys.includes(
      f.builderField?.fieldKey ||
        f.fieldKey,
    ),
  )?.value;

const borrower =
  [
    contact?.firstName,
    contact?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim() ||

  [
    getFieldValue(
      "borrowerFirstName",
      "firstName",
    ),

    getFieldValue(
      "borrowerLastName",
      "lastName",
    ),
  ]
    .filter(Boolean)
    .join(" ")
    .trim() ||

  getFieldValue(
    "borrowerName",
    "applicantName",
    "fullName",
    "name",
  ) ||

  (app?.client?.legalName &&
  app.client.legalName !==
    "Applicant"
    ? app.client.legalName
    : null) ||

  "N/A";

          const pendingDocumentsCount =
            app?.documentRequirements?.filter(
              (doc) => doc.status !== "COMPLETE",
            ).length || 0;

          // ✅ AMOUNT FROM FIELDS
          const amountField = s.fields.find(
            (f) =>
              f.builderField?.fieldKey === "amountRequested" ||
              f.builderField?.fieldKey === "loan_amount" ||
              f.fieldKey === "amountRequested" ||
              f.fieldKey === "loan_amount",
          );

          const amount = Number(
            amountField?.value || app?.amountRequested || 0,
          );

          // ✅ LOCATION FROM FIELDS + FALLBACK

          const cityField = s.fields.find(
            (f) =>
              f.builderField?.fieldKey === "propertyCity" ||
              f.builderField?.fieldKey === "city" ||
              f.fieldKey === "propertyCity" ||
              f.fieldKey === "city",
          );

          const stateField = s.fields.find(
            (f) =>
              f.builderField?.fieldKey === "propertyState" ||
              f.builderField?.fieldKey === "state" ||
              f.fieldKey === "propertyState" ||
              f.fieldKey === "state",
          );

          const countryField = s.fields.find(
            (f) =>
              f.builderField?.fieldKey === "propertyCountry" ||
              f.builderField?.fieldKey === "country" ||
              f.fieldKey === "propertyCountry" ||
              f.fieldKey === "country",
          );


          const getLocationField = (
  ...keys
) =>
  s.fields.find((f) =>
    keys.includes(
      f.builderField?.fieldKey ||
        f.fieldKey,
    ),
  )?.value;

const city =
  cityField?.value ||
  getLocationField(
    "propertyCity",
    "city",
  ) ||
  null;

const state =
  stateField?.value ||
  getLocationField(
    "propertyState",
    "state",
  ) ||
  null;

const country =
  countryField?.value ||
  getLocationField(
    "propertyCountry",
    "country",
  ) ||
  null;

          const location =
            [city, state, country].filter(Boolean).join(", ") || "N/A";

          return {
            submissionId: s.id,
            applicationId: app?.id,

            borrower,
            applicationNumber: app?.applicationNumber,
            loanInfo: app?.loanProductCode || null,

            // ✅ FIXED
            location,
            amount,

            status: app?.status,
            submissionStatus: s.status,

            submittedOn: s.createdAt,
            pendingDocumentsCount,

            assignedLoanOfficer: app?.brokerUser
              ? {
                  id: app.brokerUser.id,
                  name: `${app.brokerUser.firstName || ""} ${
                    app.brokerUser.lastName || ""
                  }`.trim(),
                  profileImage: app.brokerUser.profileImage || null,
                }
              : null,

            submittedToLenders:
              app?.applicationLenders?.map((l) => ({
                lenderOrgId: l.lenderOrgId,
                lenderName: l.lender?.name,
                profileImage: l.lender?.users?.[0]?.profileImage || null,
                status: l.status,
                sentAt: l.sentAt,
              })) || [],
          };
        });

        /* ================= STATS ================= */

        const stats = await prisma.applicationSubmission.groupBy({
          by: ["status"],
          _count: true,
          where: whereCondition,
        });

        /* ================= RESPONSE ================= */

        return reply.send({
          success: true,
          pagination: {
            nextCursor,
            limit: parsedLimit,
            hasMore: !!nextCursor,
          },
          stats,
          data,
        });
      } catch (error) {
        fastify.log.error(
          { message: error.message, stack: error.stack },
          "Submissions API Error",
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
};
