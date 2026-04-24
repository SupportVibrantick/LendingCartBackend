/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listSubmissionsTable(fastify) {
  fastify.get(
    "/submissions",
    { preHandler: fastify.authenticate },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= DEBUG ================= */
        console.log("========= DEBUG START =========");
        console.log("FULL USER:", req.user);
        console.log("USER ID (FIXED):", req.user?.userId); // ✅ FIXED
        console.log("ORG ID:", req.user?.organizationId);
        console.log("ROLES:", req.user?.roles);
        console.log("========= DEBUG END =========");

        /* ================= AUTH ================= */

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        // ✅ 🔥 FIX HERE
        const userId = req.user.userId; // ← THIS WAS YOUR BUG
        const orgId = req.user.organizationId;
        const roles = req.user.roles || [];

        const isAdmin = roles.includes("BROKER_ADMIN");
        const isOfficer = roles.includes("BROKER_OFFICER");

        if (!isAdmin && !isOfficer) {
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

            // ✅ NOW THIS WILL WORK
            ...(isOfficer && {
              brokerUserId: userId,
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
                    legalName: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                },
              ],
            }),
          },

          ...(status && { status }),
        };

        /* ================= QUERY ================= */

        const submissions = await prisma.applicationSubmission.findMany({
          where: whereCondition,

          take: parsedLimit,

          ...(cursor && {
            skip: 1,
            cursor: { id: cursor },
          }),

          orderBy: {
            [sortBy]: sortOrder,
          },

          include: {
            application: {
              select: {
                id: true,
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

          const borrower =
            app?.client?.contacts?.[0]
              ? `${app.client.contacts[0].firstName || ""} ${
                  app.client.contacts[0].lastName || ""
                }`.trim()
              : app?.client?.legalName || "N/A";

          const pendingDocumentsCount =
            app?.documentRequirements?.filter(
              (doc) => doc.status !== "COMPLETE"
            ).length || 0;

          return {
            submissionId: s.id,
            borrower,
            applicationNumber: app?.applicationNumber,
            loanInfo: app?.loanProductCode || null,
            location: "N/A",
            amount: app?.amountRequested || null,
            status: s.status,
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
                profileImage:
                  l.lender?.users?.[0]?.profileImage || null,
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
          "Submissions API Error"
        );

        return reply.code(500).send({
          success: false,
          message: "Server error while fetching submissions",
        });
      }
    }
  );
};