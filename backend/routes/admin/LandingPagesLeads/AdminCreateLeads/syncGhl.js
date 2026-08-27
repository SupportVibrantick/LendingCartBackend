const {
  syncAdminManualLeadToGhl,
} = require("../../../../services/ghl/bookDemoLeadSync");

module.exports = async function (fastify) {
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      try {
        const raw = typeof body === "string" ? body.trim() : "";
        done(null, raw ? JSON.parse(raw) : {});
      } catch (err) {
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  fastify.post(
    "/manual-leads/:id/sync-ghl",
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

    const lead = await prisma.adminManualLead.findUnique({ where: { id } });
    if (!lead) {
      return reply.code(404).send({
        success: false,
        message: "Lead not found",
      });
    }

    const updated = await syncAdminManualLeadToGhl(prisma, lead, {
      logger: req.log,
    });

    return reply.send({
      success: true,
      message:
        updated.ghlSyncStatus === "SYNCED"
          ? "GHL sync completed"
          : updated.ghlSyncStatus === "SKIPPED"
            ? "GHL sync skipped"
            : "GHL sync failed",
      data: {
        id: updated.id,
        ghlSyncStatus: updated.ghlSyncStatus,
        ghlContactId: updated.ghlContactId,
        ghlSyncedAt: updated.ghlSyncedAt,
        ghlLastError: updated.ghlLastError,
      },
    });
  });
};
