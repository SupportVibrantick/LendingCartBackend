const { isGhlEnabled } = require("../../../../config/env");
const {
  syncAdminManualLeadToGhl,
} = require("../../../../services/ghl/bookDemoLeadSync");

module.exports = async function (fastify) {
  fastify.post("/manual-leads", async (req, reply) => {
    const prisma = fastify.prisma;
    const body = req.body || {};

    const {
      firstName,
      lastName,
      email,
      phone,
      status = "NEW",
      campaign,
      metadata,
      source = "Admin",
    } = body;

    if (!email?.trim()) {
      return reply.code(400).send({
        success: false,
        message: "Email is required",
      });
    }

    const syncGhl =
      body.syncGhl === undefined
        ? true
        : body.syncGhl === true || body.syncGhl === "true";

    const lead = await prisma.adminManualLead.create({
      data: {
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        status,
        campaign: campaign?.trim() || null,
        metadata,
        source: source?.trim() || "Admin",
        ghlSyncStatus:
          syncGhl && isGhlEnabled()
            ? "PENDING"
            : isGhlEnabled()
              ? "SKIPPED"
              : "SKIPPED",
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
      // Await so admin list shows SYNCED right after create
      finalLead = await syncAdminManualLeadToGhl(prisma, lead, {
        logger: req.log,
      });
    }

    return reply.send({ success: true, data: finalLead });
  });
};
