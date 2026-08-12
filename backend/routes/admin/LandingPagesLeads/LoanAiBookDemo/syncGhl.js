const {
  syncBookDemoLeadToGhl,
} = require("../../../../services/ghl/bookDemoLeadSync");

module.exports = async function (fastify) {
  // Allow empty POST body when clients send Content-Type: application/json
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

  fastify.post("/:id/sync-ghl", async (req, reply) => {
    const prisma = fastify.prisma;
    const { id } = req.params;

    try {
      const lead = await prisma.loanAiBookDemoLead.findUnique({
        where: { id },
      });

      if (!lead) {
        return reply.status(404).send({
          success: false,
          message: "Lead not found",
        });
      }

      const updated = await syncBookDemoLeadToGhl(prisma, lead, {
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
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        success: false,
        message: "Failed to sync lead to GHL",
      });
    }
  });
};
