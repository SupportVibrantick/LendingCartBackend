const { isGhlEnabled } = require("../../../../config/env");
const {
  syncBookDemoLeadToGhl,
} = require("../../../../services/ghl/bookDemoLeadSync");
const { getClientIp } = require("../../../../utils/security/rateLimit");

module.exports = async function (fastify) {
  fastify.post(
    "/",
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
    const body = req.body || {};

    const email = body.email?.trim()?.toLowerCase();
    if (!email) {
      return reply.code(400).send({
        success: false,
        message: "Email is required",
      });
    }

    const syncGhl =
      body.syncGhl === undefined
        ? true
        : body.syncGhl === true || body.syncGhl === "true";

    const lead = await prisma.loanAiBookDemoLead.create({
      data: {
        firstName: body.firstName?.trim() || null,
        lastName: body.lastName?.trim() || null,
        email,
        phone: body.phone?.trim() || null,
        company: body.company?.trim() || null,
        message: body.message?.trim() || null,
        interestedPlanCode: body.interestedPlanCode?.trim() || null,
        interestedPlanName: body.interestedPlanName?.trim() || null,
        status: body.status || "NEW",
        source: "loan-ai-book-demo",
        ghlSyncStatus:
          syncGhl && isGhlEnabled() ? "PENDING" : "SKIPPED",
        ghlLastError:
          syncGhl && isGhlEnabled()
            ? null
            : isGhlEnabled()
              ? "Sync skipped on create"
              : "GHL_ENABLED=false",
      },
    });

    let finalLead = lead;
    if (syncGhl && isGhlEnabled()) {
      finalLead = await syncBookDemoLeadToGhl(prisma, lead, {
        logger: req.log,
      });
    }

    return reply.code(201).send({
      success: true,
      message: "Book demo contact created",
      data: finalLead,
    });
  });
};
