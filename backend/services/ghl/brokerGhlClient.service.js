/**
 * Broker-owned GHL API client (OAuth per organization).
 * Never uses platform GHL_API_KEY / GHL_LOCATION_ID.
 */

const axios = require("axios");
const {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} = require("../../utils/security/secretEncryption");
const {
  refreshAccessToken,
  computeTokenExpiresAt,
} = require("./ghlOAuth.service");
const { sanitizeAxiosError } = require("../../modules/ghl/ghl.service");
const {
  BROKER_GHL_ERROR_CODES,
  BrokerGhlError,
  brokerGhlError,
  sanitizeProviderMessage,
} = require("./brokerGhlErrors");

const GHL_API_BASE =
  process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com";
const GHL_API_VERSION = process.env.GHL_API_VERSION || "2021-07-28";
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;

function assertOrganizationId(organizationId) {
  if (!organizationId || !String(organizationId).trim()) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.ORG_ISOLATION, 400);
  }
  return String(organizationId).trim();
}

async function loadConnectionForOrganization(prisma, organizationId) {
  const orgId = assertOrganizationId(organizationId);
  const connection = await prisma.organizationGhlConnection.findUnique({
    where: { organizationId: orgId },
  });

  if (!connection) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.NOT_CONNECTED, 404);
  }

  if (connection.organizationId !== orgId) {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.ORG_ISOLATION, 403);
  }

  return connection;
}

function assertConnectionCallable(connection) {
  if (connection.status === "DISCONNECTED") {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.CONNECTION_INACTIVE, 409);
  }
  if (connection.status === "ERROR") {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.CONNECTION_ERROR, 409);
  }
  if (connection.status !== "CONNECTED") {
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.CONNECTION_INACTIVE, 409);
  }
}

async function markConnectionError(prisma, connectionId, message) {
  const safe = sanitizeProviderMessage(message) || "GoHighLevel connection error";
  await prisma.organizationGhlConnection.update({
    where: { id: connectionId },
    data: {
      status: "ERROR",
      lastError: safe,
    },
  });
}

function tokenNeedsRefresh(connection) {
  if (!connection.tokenExpiresAt) return false;
  const expiresAt = new Date(connection.tokenExpiresAt).getTime();
  if (Number.isNaN(expiresAt)) return false;
  return expiresAt - Date.now() <= REFRESH_THRESHOLD_MS;
}

async function persistRefreshedTokens(prisma, connection, refreshed) {
  return prisma.organizationGhlConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encryptSecret(refreshed.accessToken),
      refreshToken: refreshed.refreshToken
        ? encryptSecret(refreshed.refreshToken)
        : connection.refreshToken,
      tokenExpiresAt: computeTokenExpiresAt(refreshed.expiresIn),
      scopes: refreshed.scopes?.length ? refreshed.scopes : connection.scopes,
      ghlCompanyId: refreshed.companyId || connection.ghlCompanyId,
      ghlLocationId: refreshed.locationId || connection.ghlLocationId,
      status: "CONNECTED",
      lastError: null,
    },
  });
}

async function refreshConnectionTokens(prisma, connection) {
  if (!connection.refreshToken) {
    await markConnectionError(
      prisma,
      connection.id,
      "GoHighLevel refresh token missing",
    );
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.TOKEN_EXPIRED, 409);
  }

  let refreshTokenPlain;
  try {
    refreshTokenPlain = decryptSecret(connection.refreshToken);
  } catch {
    await markConnectionError(
      prisma,
      connection.id,
      "GoHighLevel token decryption failed",
    );
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.TOKEN_REFRESH_FAILED, 502);
  }

  try {
    const refreshed = await refreshAccessToken(refreshTokenPlain);
    const updated = await persistRefreshedTokens(prisma, connection, refreshed);
    return {
      accessToken: refreshed.accessToken,
      connection: updated,
      refreshed: true,
    };
  } catch (err) {
    await markConnectionError(
      prisma,
      connection.id,
      "GoHighLevel token refresh failed",
    );
    throw brokerGhlError(BROKER_GHL_ERROR_CODES.TOKEN_REFRESH_FAILED, 502);
  }
}

/**
 * Resolve a valid access token for the broker org. Never expose via HTTP handlers.
 * @returns {Promise<{ accessToken: string, connection: object, refreshed: boolean }>}
 */
async function getAccessTokenForOrganization(prisma, organizationId) {
  let connection = await loadConnectionForOrganization(prisma, organizationId);
  assertConnectionCallable(connection);

  if (!tokenNeedsRefresh(connection)) {
    if (!isEncryptedSecret(connection.accessToken)) {
      await markConnectionError(
        prisma,
        connection.id,
        "GoHighLevel token storage invalid",
      );
      throw brokerGhlError(BROKER_GHL_ERROR_CODES.CONNECTION_ERROR, 409);
    }

    let accessToken;
    try {
      accessToken = decryptSecret(connection.accessToken);
    } catch {
      await markConnectionError(
        prisma,
        connection.id,
        "GoHighLevel token decryption failed",
      );
      throw brokerGhlError(BROKER_GHL_ERROR_CODES.TOKEN_REFRESH_FAILED, 502);
    }

    return { accessToken, connection, refreshed: false };
  }

  return refreshConnectionTokens(prisma, connection);
}

function createAxiosClient(accessToken) {
  return axios.create({
    baseURL: GHL_API_BASE,
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Version: GHL_API_VERSION,
      Accept: "application/json",
    },
  });
}

/**
 * @returns {Promise<{ client: import('axios').AxiosInstance, locationId: string, organizationId: string, connection: object }>}
 */
async function getClientForOrganization(prisma, organizationId) {
  const { accessToken, connection, refreshed } =
    await getAccessTokenForOrganization(prisma, organizationId);

  return {
    client: createAxiosClient(accessToken),
    locationId: connection.ghlLocationId,
    organizationId: connection.organizationId,
    connection,
    refreshed,
  };
}

function mapAxiosErrorToBrokerGhlError(err) {
  const status = err.response?.status;
  const apiMessage = sanitizeProviderMessage(
    err.response?.data?.message ||
      err.response?.data?.msg ||
      err.response?.data?.error ||
      err.message,
  );

  if (status === 401) {
    return brokerGhlError(BROKER_GHL_ERROR_CODES.TOKEN_EXPIRED, 401);
  }
  if (status === 403) {
    return new BrokerGhlError(
      BROKER_GHL_ERROR_CODES.FORBIDDEN,
      apiMessage || undefined,
      { statusCode: 403 },
    );
  }
  if (status === 404) {
    return brokerGhlError(BROKER_GHL_ERROR_CODES.NOT_FOUND, 404);
  }
  if (status === 429) {
    return brokerGhlError(BROKER_GHL_ERROR_CODES.RATE_LIMITED, 429);
  }
  if (!err.response && (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT")) {
    return brokerGhlError(BROKER_GHL_ERROR_CODES.API_FAILED, 504);
  }

  return new BrokerGhlError(
    BROKER_GHL_ERROR_CODES.API_FAILED,
    apiMessage || undefined,
    { statusCode: status && status >= 400 && status < 600 ? status : 502 },
  );
}

/**
 * Authenticated GHL request scoped to a broker organization.
 * @param {object} prisma
 * @param {string} organizationId
 * @param {import('axios').AxiosRequestConfig} config
 */
async function requestForOrganization(prisma, organizationId, config = {}) {
  const orgId = assertOrganizationId(organizationId);
  const { client, connection } = await getClientForOrganization(prisma, orgId);

  try {
    const res = await client.request(config);
    return res.data;
  } catch (err) {
    console.error(
      "Broker GHL API error:",
      sanitizeAxiosError(err),
      { organizationId: orgId },
    );

    const status = err.response?.status;
    if (status === 401) {
      await markConnectionError(
        prisma,
        connection.id,
        "GoHighLevel rejected the access token",
      );
    }

    throw mapAxiosErrorToBrokerGhlError(err);
  }
}

module.exports = {
  GHL_API_BASE,
  GHL_API_VERSION,
  REFRESH_THRESHOLD_MS,
  assertOrganizationId,
  loadConnectionForOrganization,
  getAccessTokenForOrganization,
  getClientForOrganization,
  requestForOrganization,
  markConnectionError,
  tokenNeedsRefresh,
  refreshConnectionTokens,
  persistRefreshedTokens,
  mapAxiosErrorToBrokerGhlError,
};
