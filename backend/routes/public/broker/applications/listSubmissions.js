/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listSubmissionsTable(fastify) {
  fastify.get("/submissions", async (req, reply) => {
    const submissions = await fastify.prisma.applicationSubmission.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        application: {
          select: {
            applicationNumber: true, // ✅ ADD HERE
            documentRequirements: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });

    return reply.send({
      success: true,
      data: submissions.map((s) => {
        const pendingDocumentsCount = s.application.documentRequirements.filter(
          (doc) => doc.status !== "COMPLETE",
        ).length;

        return {
          submissionId: s.id,
          applicationNumber: s.application.applicationNumber,
          status: s.status,
          submittedOn: s.createdAt,
          pendingDocumentsCount,
        };
      }),
    });
  });
};
