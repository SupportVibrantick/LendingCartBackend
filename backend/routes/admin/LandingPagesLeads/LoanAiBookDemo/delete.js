module.exports = async function (fastify) {
  fastify.delete(
    "/:id",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: (req) => `admin:${req.user?.userId ?? req.ip}`,
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many requests. Please slow down.",
          }),
        },
      },
    },
    async (req, reply) => {
    const prisma = fastify.prisma;
    const { id } = req.params;

    await prisma.loanAiBookDemoLead.delete({
      where: { id },
    });

    return reply.send({
      success: true,
      message: "Lead deleted successfully",
    });
  });
};
