// modules/campaign/campaign.controller.js

const campaignService = require("./campaign.service");
const { validateCreateCampaign } = require("./campaign.validator");

const createCampaign = async (req, res) => {
  try {
    validateCreateCampaign(req.body);

    const campaign = await campaignService.createCampaign(
      req.body,
      req.user
    );

    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ✅ NEW
const addRecipients = async (req, res) => {
  try {
    const result = await campaignService.addRecipients(
      req.body,
      req.user
    );

    res.json({
      success: true,
      message: "Recipients added successfully",
      data: result,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  createCampaign,
  addRecipients,
};