// backend/config/openfga.js
const { OpenFgaClient } = require("@openfga/sdk");

const fgaClient = new OpenFgaClient({
  apiScheme: process.env.FGA_API_SCHEME || "http",
  apiHost: process.env.FGA_API_HOST || "localhost:8080",
  storeId: process.env.FGA_STORE_ID,
  authorizationModelId: process.env.FGA_MODEL_ID,
});

module.exports = { fgaClient };
