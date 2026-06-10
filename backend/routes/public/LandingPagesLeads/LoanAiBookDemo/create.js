const {
  notifyPlatform,
  PLATFORM_NOTIFICATION_EVENTS,
} = require("../../../../services/platformNotifications");

function splitFullName(fullName) {
  const trimmed = (fullName || "").trim();
  if (!trimmed) return { firstName: null, lastName: null };

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

module.exports = async function (fastify) {
  fastify.post("/", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const { fullName, email, phone, company, message } = req.body;

      if (!fullName?.trim()) {
        return reply.status(400).send({
          success: false,
          message: "Full name is required",
        });
      }

      if (!email?.trim()) {
        return reply.status(400).send({
          success: false,
          message: "Email is required",
        });
      }

      const { firstName, lastName } = splitFullName(fullName);

      const lead = await prisma.loanAiBookDemoLead.create({
        data: {
          firstName,
          lastName,
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || null,
          company: company?.trim() || null,
          message: message?.trim() || null,
        },
      });

      try {
        const leadName = [firstName, lastName].filter(Boolean).join(" ").trim();
        await notifyPlatform(prisma, fastify.io, {
          eventType: PLATFORM_NOTIFICATION_EVENTS.LANDING_PAGE_LEAD,
          category: "LEAD",
          subject: "New Loan AI demo request",
          body: leadName
            ? `Demo booked by ${leadName} (${lead.email})`
            : `New demo request: ${lead.email}`,
          metadata: {
            leadId: lead.id,
            firstName,
            lastName,
            email: lead.email,
            phone: lead.phone,
            company: lead.company,
            message: lead.message,
            source: "loan-ai-book-demo",
          },
        });
      } catch (notifyErr) {
        req.log.error({ err: notifyErr }, "Book demo notification failed");
      }

      return reply.status(201).send({
        success: true,
        message: "Demo request submitted successfully",
        data: { id: lead.id },
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
