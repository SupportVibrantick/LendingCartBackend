const {
  notifyPlatform,
  PLATFORM_NOTIFICATION_EVENTS,
} = require("../../../../services/notifications/platformNotifications");
const {
  checkRateLimit,
  getClientIp,
} = require("../../../../utils/security/rateLimit");
const { isGhlEnabled } = require("../../../../config/env");
const {
  syncBookDemoLeadToGhlInBackground,
} = require("../../../../services/ghl/bookDemoLeadSync");

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

function resolveName(body) {
  const firstName = body.firstName?.trim() || null;
  const lastName = body.lastName?.trim() || null;

  if (firstName || lastName) {
    return { firstName, lastName };
  }

  if (body.fullName?.trim()) {
    return splitFullName(body.fullName);
  }

  return { firstName: null, lastName: null };
}

module.exports = async function (fastify) {
  fastify.post("/", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const ip = getClientIp(req);
      const limit = checkRateLimit(`loan-ai-book-demo:${ip}`, {
        windowMs: 15 * 60 * 1000,
        max: 8,
      });

      if (!limit.allowed) {
        return reply.status(429).send({
          success: false,
          message: "Too many demo requests. Please try again later.",
          retryAfterSec: limit.retryAfterSec,
        });
      }

      const {
        email,
        phone,
        company,
        message,
        interestedPlanCode,
        interestedPlanName,
        planCode,
        planName,
      } = req.body || {};

      const { firstName, lastName } = resolveName(req.body || {});

      if (!firstName && !lastName) {
        return reply.status(400).send({
          success: false,
          message: "First name or full name is required",
        });
      }

      if (!email?.trim()) {
        return reply.status(400).send({
          success: false,
          message: "Email is required",
        });
      }

      const resolvedPlanCode =
        interestedPlanCode?.trim() || planCode?.trim() || null;
      const resolvedPlanName =
        interestedPlanName?.trim() || planName?.trim() || null;

      const lead = await prisma.loanAiBookDemoLead.create({
        data: {
          firstName,
          lastName,
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || null,
          company: company?.trim() || null,
          message: message?.trim() || null,
          interestedPlanCode: resolvedPlanCode,
          interestedPlanName: resolvedPlanName,
          source: "loan-ai-book-demo",
          ghlSyncStatus: isGhlEnabled() ? "PENDING" : "SKIPPED",
          ghlLastError: isGhlEnabled() ? null : "GHL_ENABLED=false",
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
            interestedPlanCode: lead.interestedPlanCode,
            interestedPlanName: lead.interestedPlanName,
            source: "loan-ai-book-demo",
          },
        });
      } catch (notifyErr) {
        req.log.error({ err: notifyErr }, "Book demo notification failed");
      }

      syncBookDemoLeadToGhlInBackground(prisma, lead, { logger: req.log });

      return reply.status(201).send({
        success: true,
        message: "Demo request submitted successfully",
        data: {
          id: lead.id,
          ghlSyncStatus: lead.ghlSyncStatus,
        },
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
