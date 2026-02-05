/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listSubmissionsTable(fastify) {
  fastify.get("/submissions", async (req, reply) => {
    const submissions = await fastify.prisma.applicationSubmission.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    return reply.send({
      success: true,
      data: submissions.map((s) => ({
        submissionId: s.id,
        status: s.status,
        submittedOn: s.createdAt,
      })),
    });
  });
};
