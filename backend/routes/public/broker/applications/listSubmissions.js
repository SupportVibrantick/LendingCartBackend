/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listSubmissionsTable(fastify) {
  fastify.get("/submissions", async (req, reply) => {
    const submissions = await fastify.prisma.applicationSubmission.findMany({
      orderBy: {
        createdAt: "desc",
      },
      distinct: ["applicationId"], // ✅ FIX: only latest submission per application
      include: {
        application: {
          select: {
            applicationNumber: true,
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
          (doc) => doc.status !== "COMPLETE"
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