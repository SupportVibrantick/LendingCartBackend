module.exports = async function (fastify) {
  fastify.delete(
    "/manual-leads/:id",
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

    try {
      await prisma.adminManualLead.delete({ where: { id } });
    } catch (err) {
      if (err.code === "P2025") {
        return reply.code(404).send({
          success: false,
          message: "Lead not found",
        });
      }
      throw err;
    }

    return reply.send({
      success: true,
      message: "Lead deleted successfully",
    });
  });
};
