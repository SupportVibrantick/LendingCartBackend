const { getClientIp } = require("../../../utils/security/rateLimit");

module.exports = async function (fastify) {
  fastify.patch(
    "/status",
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

    const { id, status, leadType } = req.body;

    if (!id || !status || !leadType) {
      return reply.code(400).send({
        success: false,
        message: "id, status and leadType are required",
      });
    }

    let model;

    switch (leadType) {
      case "COMMERCIAL_LENDING_MASTERY":
        model = prisma.commercialLendingMasteryLead;
        break;
      case "CLM_LANDING_PAGE":
        model = prisma.clmLandingPageLead;
        break;
      case "ADMIN_MANUAL":
        model = prisma.adminManualLead;
        break;
      case "LOAN_AI_BOOK_DEMO":
        model = prisma.loanAiBookDemoLead;
        break;
      default:
        return reply.code(400).send({
          success: false,
          message: "Invalid leadType",
        });
    }

    const result = await model.updateMany({
      where: { id },
      data: { status },
    });

    if (result.count === 0) {
      return reply.code(404).send({
        success: false,
        message: "Lead not found for given leadType",
      });
    }

    return reply.send({
      success: true,
      message: "Status updated successfully",
    });
  });
};