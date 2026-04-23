/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listSubmissionsTable(fastify) {
  fastify.get("/submissions", async (req, reply) => {
    try {
      const submissions = await fastify.prisma.applicationSubmission.findMany({
        orderBy: {
          createdAt: "desc",
        },
        distinct: ["applicationId"],

        include: {
          application: {
            select: {
              applicationNumber: true,
              loanProductCode: true,
              amountRequested: true,

              // ✅ CLIENT (BORROWER INFO)
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

              // ✅ DOCUMENT STATUS
              documentRequirements: {
                select: {
                  status: true,
                },
              },

              // ✅ ASSIGNED LOAN OFFICER
              brokerUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  profileImage: true,
                },
              },

              // ✅ LENDER DATA
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

      const data = submissions.map((s) => {
        const app = s.application;

        // ✅ Borrower Name Logic
        const borrower =
          app.client?.contacts?.[0]
            ? `${app.client.contacts[0].firstName || ""} ${
                app.client.contacts[0].lastName || ""
              }`.trim()
            : app.client?.legalName || "N/A";

        // ✅ Pending Documents Count
        const pendingDocumentsCount =
          app.documentRequirements.filter(
            (doc) => doc.status !== "COMPLETE"
          ).length;

        return {
          submissionId: s.id,

          // ✅ REQUIRED UI FIELDS
          borrower,
          applicationNumber: app.applicationNumber,
          loanInfo: app.loanProductCode || null,
          location: "N/A", // update later if you store city/state
          amount: app.amountRequested || null,

          status: s.status,
          submittedOn: s.createdAt,
          pendingDocumentsCount,

          // ✅ ASSIGNED LOAN OFFICER
          assignedLoanOfficer: app.brokerUser
            ? {
                id: app.brokerUser.id,
                name: `${app.brokerUser.firstName || ""} ${
                  app.brokerUser.lastName || ""
                }`.trim(),
                profileImage: app.brokerUser.profileImage || null,
              }
            : null,

          // ✅ LENDER LIST
          submittedToLenders: app.applicationLenders.map((l) => ({
            lenderOrgId: l.lenderOrgId,
            lenderName: l.lender?.name,
            profileImage: l.lender?.users?.[0]?.profileImage || null,
            status: l.status,
            sentAt: l.sentAt,
          })),
        };
      });

      return reply.send({
        success: true,
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