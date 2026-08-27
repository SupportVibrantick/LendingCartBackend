const { LeadStatus } = require("@prisma/client");
const { getClientIp } = require("../../../../utils/security/rateLimit");

module.exports = async function (fastify) {
  fastify.patch(
    "/:id/status",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: (req) => `admin-ip:${getClientIp(req)}`,
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
    const { status } = req.body;

    if (!Object.values(LeadStatus).includes(status)) {
      return reply.status(400).send({
        success: false,
        message: "Invalid status",
      });
    }

    const result = await prisma.loanAiBookDemoLead.updateMany({
      where: { id },
      data: { status },
    });

    if (result.count === 0) {
      return reply.status(404).send({
        success: false,
        message: "Lead not found",
      });
    }

    return reply.send({
      success: true,
      message: "Status updated successfully",
    });
  });
};
