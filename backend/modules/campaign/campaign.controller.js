// modules/campaign/campaign.controller.js

const { adminLogs } = require("../../services/logger/contextLogger");
const campaignService = require("./campaign.service");

const sendCampaign = async (req, reply) => {
  try {
    const { contacts, subject, message } = req.body;

    // ✅ validation
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

    // ✅ get prisma from fastify
    const prisma = req.server.prisma;

    // ✅ auth info (safe fallback)
    const orgId = req.user?.organizationId;
    const createdById = req.user?.id;

    if (!orgId) {
      return reply.status(400).send({
        success: false,
        message: "Organization not found in user",
      });
    }

    const result = await campaignService.sendCampaign({
      prisma,
      orgId,
      createdById,
      contacts,
      subject,
      message,
    });

    return reply.status(200).send({
      success: true,
      message: "Campaign sent successfully",
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

module.exports = {
  sendCampaign,
};