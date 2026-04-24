/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listSubmissionsTable(fastify) {
  fastify.get("/submissions", async (req, reply) => {
    try {
      const prisma = fastify.prisma;

      /* ================= QUERY PARAMS ================= */

      const {
        cursor,
        limit = 10,
        search,
        status,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      /* ================= ROLE FILTER ================= */

      let whereCondition = {};

      if (req.user?.roles?.includes("BROKER_OFFICER")) {
        whereCondition = {
          application: {
            brokerUserId: {
              equals: req.user.id, // ✅ STRICT MATCH (FIXED)
            },
          },
        };
      }

      /* ================= SEARCH ================= */

      if (search) {
        whereCondition = {
          ...whereCondition,
          application: {
            ...whereCondition.application,
            OR: [
              {
                applicationNumber: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                client: {
                  legalName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            ],
          },
        };
      }

      /* ================= STATUS FILTER ================= */

      if (status) {
        whereCondition = {
          ...whereCondition,
          status,
        };
      }

      /* ================= SORT ================= */

      const orderBy = {
        [sortBy]: sortOrder,
      };

      /* ================= QUERY ================= */

      const submissions = await prisma.applicationSubmission.findMany({
        where: whereCondition,
        take: Number(limit),
        ...(cursor && {
          skip: 1,
          cursor: { id: cursor },
        }),
        orderBy,

        // ⚠️ IMPORTANT: REMOVED distinct (ROOT CAUSE FIX)
        // distinct: ["applicationId"],

        include: {
          application: {
            where: req.user?.roles?.includes("BROKER_OFFICER")
              ? {
                  brokerUserId: {
                    equals: req.user.id, // 🔥 DOUBLE SAFETY
                  },
                }
              : undefined,

            select: {
              applicationNumber: true,
              loanProductCode: true,
              amountRequested: true,

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
                select: {
                  status: true,
                },
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
                      id: true,
                      name: true,
                      users: {
                        select: {
                          profileImage: true,
                        },
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

      /* ================= NEXT CURSOR ================= */

      const nextCursor =
        submissions.length === Number(limit)
          ? submissions[submissions.length - 1].id
          : null;

      /* ================= SAFE FILTER (FINAL GUARD) ================= */

      const safeSubmissions = submissions.filter((s) => {
        if (!req.user?.roles?.includes("BROKER_OFFICER")) return true;

        return (
          s.application &&
          s.application.brokerUser &&
          s.application.brokerUser.id === req.user.id
        );
      });

      /* ================= MAPPING ================= */

      const data = safeSubmissions.map((s) => {
        const app = s.application;

        const borrower =
          app.client?.contacts?.[0]
            ? `${app.client.contacts[0].firstName || ""} ${
                app.client.contacts[0].lastName || ""
              }`.trim()
            : app.client?.legalName || "N/A";

        const pendingDocumentsCount =
          app.documentRequirements.filter(
            (doc) => doc.status !== "COMPLETE"
          ).length;

        return {
          submissionId: s.id,
          borrower,
          applicationNumber: app.applicationNumber,
          loanInfo: app.loanProductCode || null,
          location: "N/A",
          amount: app.amountRequested || null,
          status: s.status,
          submittedOn: s.createdAt,
          pendingDocumentsCount,

          assignedLoanOfficer: app.brokerUser
            ? {
                id: app.brokerUser.id,
                name: `${app.brokerUser.firstName || ""} ${
                  app.brokerUser.lastName || ""
                }`.trim(),
                profileImage: app.brokerUser.profileImage || null,
              }
            : null,

          submittedToLenders: app.applicationLenders.map((l) => ({
            lenderOrgId: l.lenderOrgId,
            lenderName: l.lender?.name,
            profileImage: l.lender?.users?.[0]?.profileImage || null,
            status: l.status,
            sentAt: l.sentAt,
          })),
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
          limit: Number(limit),
          hasMore: !!nextCursor,
        },

        stats,

        data,
      });
    } catch (error) {
      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Server error while fetching submissions",
      });
    }
  });
};