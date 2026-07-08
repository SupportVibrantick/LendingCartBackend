const {
  notifyPlatform,
  PLATFORM_NOTIFICATION_EVENTS,
} = require("../../../../services/notifications/platformNotifications");

module.exports = async function (fastify) {
  fastify.post("/", async (req, reply) => {
    const prisma = fastify.prisma;
    try {
      const { firstName, lastName, email, phone } = req.body;

      if (!email) {
        return reply.status(400).send({
          success: false,
          message: "Email is required",
        });
      }

      const lead = await prisma.clmLandingPageLead.create({
        data: {
          firstName,
          lastName,
          email,
          phone,
        },
      });

      try {
        const leadName = [firstName, lastName].filter(Boolean).join(" ").trim();
        await notifyPlatform(prisma, fastify.io, {
          eventType: PLATFORM_NOTIFICATION_EVENTS.LANDING_PAGE_LEAD,
          category: "LEAD",
          subject: "New landing page lead",
          body: leadName
            ? `New lead from ${leadName} (${email})`
            : `New landing page lead: ${email}`,
          metadata: {
            leadId: lead.id,
            firstName,
            lastName,
            email,
            phone,
          },
        });
      } catch (notifyErr) {
        req.log.error({ err: notifyErr }, "Landing lead notification failed");
      }

      return reply.status(201).send({
        success: true,
        message: "Lead submitted successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        success: false,
        message: "Internal server error",
      });
    }
  });
};
