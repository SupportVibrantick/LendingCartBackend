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
        distinct: ["applicationId"], // keep your logic intact
        include: {
          application: {
            select: {
              applicationNumber: true,

              documentRequirements: {
                select: {
                  status: true,
                },
              },

              // ✅ LENDER DATA (OPTIMIZED)
              applicationLenders: {
                select: {
                  lenderOrgId: true,
                  status: true,
                  sentAt: true,
                  lender: {
                    select: {
                      id: true,
                      name: true,

                      // ✅ PROFILE IMAGE (SAFE FETCH)
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
        const pendingDocumentsCount =
          s.application.documentRequirements.filter(
            (doc) => doc.status !== "COMPLETE"
          ).length;

        return {
          submissionId: s.id,
          applicationNumber: s.application.applicationNumber,
          status: s.status,
          submittedOn: s.createdAt,
          pendingDocumentsCount,

          // ✅ LENDER LIST WITH PROFILE IMAGE
          submittedToLenders: s.application.applicationLenders.map((l) => ({
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