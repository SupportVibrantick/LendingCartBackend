const axios = require("axios");

const ghlClient = axios.create({
  baseURL: process.env.GHL_WEBHOOK_URL || "https://services.leadconnectorhq.com",
  headers: {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    "Content-Type": "application/json",
    Version: "2021-07-28",
  },
});

module.exports = ghlClient;