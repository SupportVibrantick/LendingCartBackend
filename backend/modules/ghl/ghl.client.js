const axios = require("axios");

const GHL_API_BASE =
  process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com";

function createGhlApiClient() {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    throw new Error("GHL_API_KEY is required for contact sync");
  }

  return axios.create({
    baseURL: GHL_API_BASE,
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: process.env.GHL_API_VERSION || "2021-07-28",
      Accept: "application/json",
    },
  });
}

module.exports = {
  createGhlApiClient,
  GHL_API_BASE,
};
