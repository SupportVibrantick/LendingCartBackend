// modules/campaign/campaign.controller.js

const { adminLogs } = require("../../services/logger/contextLogger");
const campaignService = require("./campaign.service");

const sendCampaign = async (req, reply) => {
  try {
    const {
      contacts,
      subject,
      message,
      isRecurring,
      intervalValue,
      intervalUnit,
    } = req.body;

    // ✅ existing validation (unchanged)
    if (!contacts || contacts.length === 0) {
      return reply.status(400).send({
        success: false,
        message: "Contacts are required",
      });
    }

    if (!subject || !message) {
      return reply.status(400).send({
        success: false,
        message: "Subject and message are required",
      });
    }

    // ✅ NEW: recurring validation (safe)
    if (isRecurring === true) {
      if (!intervalValue || !intervalUnit) {
        return reply.status(400).send({
          success: false,
          message: "intervalValue and intervalUnit are required for recurring campaigns",
        });
      }

      if (!["MINUTES", "HOURS", "DAYS"].includes(intervalUnit)) {
  return reply.status(400).send({
    success: false,
    message: "intervalUnit must be 'MINUTES', 'HOURS' or 'DAYS'",
  });
}

      if (intervalValue <= 0) {
        return reply.status(400).send({
          success: false,
          message: "intervalValue must be greater than 0",
        });
      }
    }

    // ✅ get prisma from fastify
    const prisma = req.server.prisma;

    // ✅ auth info (unchanged)
    const orgId = req.user?.organizationId;
    const createdById = req.user?.id;

    if (!orgId) {
      return reply.status(400).send({
        success: false,
        message: "Organization not found in user",
      });
    }

    // ✅ call service (extended but backward compatible)
    const result = await campaignService.sendCampaign({
      prisma,
      orgId,
      createdById,
      contacts,
      subject,
      message,
      isRecurring: isRecurring || false,
      intervalValue: isRecurring ? intervalValue : null,
      intervalUnit: isRecurring ? intervalUnit : null,
    });

    return reply.status(200).send({
      success: true,
      message: isRecurring
        ? "Recurring campaign scheduled successfully"
        : "Campaign sent successfully",
      data: result,
    });

  } catch (error) {
    adminLogs.error("Failed to send campaign", {
      error,
      body: req.body,
    });

    return reply.status(500).send({
      success: false,
      message: "Server error while sending campaign",
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

const stopCampaign = async (req, reply) => {
  try {
    const { id } = req.params;

    if (!id) {
      return reply.status(400).send({
        success: false,
        message: "Campaign id is required",
      });
    }

    const prisma = req.server.prisma;

    // check campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return reply.status(404).send({
        success: false,
        message: "Campaign not found",
      });
    }

    // stop campaign
    await prisma.campaign.update({
      where: { id },
      data: {
        status: "FAILED",       // or STOPPED if you add enum
        isRecurring: false,     // stop cron
      },
    });

    return reply.send({
      success: true,
      message: "Campaign stopped successfully",
    });

  } catch (error) {
    adminLogs.error("Stop campaign failed", { error });

    return reply.status(500).send({
      success: false,
      message: "Server error while stopping campaign",
    });
  }
};



module.exports = {
  sendCampaign,
  stopCampaign,
}; 