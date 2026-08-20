const axios = require("axios");
const {
  encryptSecret,
  decryptSecret,
} = require("../../utils/security/secretEncryption");
const { sanitizeAxiosError } = require("../../modules/ghl/ghl.service");

const DEFAULT_AUTHORIZE_URL =
  "https://marketplace.gohighlevel.com/oauth/chooselocation";
const DEFAULT_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
const DEFAULT_OAUTH_SCOPES =
  "funnels/funnel.readonly funnels/page.readonly funnels/pagecount.readonly";

class GhlOAuthError extends Error {
  constructor(message, { statusCode = 400, code = "GHL_OAUTH_ERROR" } = {}) {
    super(message);
    this.name = "GhlOAuthError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getOAuthConfig() {
  const clientId = process.env.GHL_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GHL_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GHL_OAUTH_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new GhlOAuthError(
      "GHL OAuth is not configured (missing client id, secret, or redirect URI)",
      { statusCode: 503, code: "GHL_OAUTH_NOT_CONFIGURED" },
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    authorizeUrl:
      process.env.GHL_OAUTH_AUTHORIZE_URL?.trim() || DEFAULT_AUTHORIZE_URL,
    tokenUrl: process.env.GHL_OAUTH_TOKEN_URL?.trim() || DEFAULT_TOKEN_URL,
    scopes:
      process.env.GHL_OAUTH_SCOPES?.trim() || DEFAULT_OAUTH_SCOPES,
  };
}

function isGhlOAuthConfigured() {
  try {
    getOAuthConfig();
    return true;
  } catch {
    return false;
  }
}

function buildAuthorizationUrl(state) {
  const config = getOAuthConfig();
  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    scope: config.scopes,
    state,
  });

  const versionId = process.env.GHL_OAUTH_APP_VERSION_ID?.trim();
  if (versionId) {
    params.set("version_id", versionId);
  }

  return `${config.authorizeUrl}?${params.toString()}`;
}

function parseScopes(scopeValue) {
  if (!scopeValue) return [];
  if (Array.isArray(scopeValue)) {
    return scopeValue.map((s) => String(s).trim()).filter(Boolean);
  }
  return String(scopeValue)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function computeTokenExpiresAt(expiresIn) {
  const seconds = Number(expiresIn);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000);
}

function normalizeTokenResponse(data = {}) {
  const locationId =
    data.locationId ||
    data.location_id ||
    data.location?.id ||
    data.location?._id ||
    null;
  const companyId =
    data.companyId ||
    data.company_id ||
    data.company?.id ||
    null;
  const userType = data.userType || data.user_type || null;

  return {
    accessToken: data.access_token || data.accessToken || null,
    refreshToken: data.refresh_token || data.refreshToken || null,
    expiresIn: data.expires_in ?? data.expiresIn ?? null,
    scopes: parseScopes(data.scope || data.scopes),
    locationId: locationId ? String(locationId) : null,
    companyId: companyId ? String(companyId) : null,
    userType: userType ? String(userType) : null,
    raw: data,
  };
}

async function exchangeAuthorizationCode(code) {
  const config = getOAuthConfig();
  if (!code) {
    throw new GhlOAuthError("Authorization code is required", {
      statusCode: 400,
      code: "MISSING_CODE",
    });
  }

  try {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      user_type: "Location",
    });

    const res = await axios.post(config.tokenUrl, body.toString(), {
      timeout: 15000,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const normalized = normalizeTokenResponse(res.data);
    if (!normalized.accessToken) {
      throw new GhlOAuthError("GHL token response missing access_token", {
        statusCode: 502,
        code: "INVALID_TOKEN_RESPONSE",
      });
    }

    if (!normalized.locationId) {
      throw new GhlOAuthError(
        "GHL connection must target a sub-account location. Please select a location during installation.",
        { statusCode: 400, code: "MISSING_LOCATION" },
      );
    }

    return normalized;
  } catch (err) {
    if (err instanceof GhlOAuthError) throw err;
    console.error("GHL OAuth code exchange failed:", sanitizeAxiosError(err));
    const status = err.response?.status;
    const apiMessage =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message;
    throw new GhlOAuthError(
      status === 401 || status === 403
        ? "GHL rejected the authorization code"
        : `Failed to exchange GHL authorization code: ${apiMessage}`,
      {
        statusCode: status && status >= 400 && status < 600 ? status : 502,
        code: "TOKEN_EXCHANGE_FAILED",
      },
    );
  }
}

async function refreshAccessToken(refreshTokenPlain) {
  const config = getOAuthConfig();
  if (!refreshTokenPlain) {
    throw new GhlOAuthError("Refresh token is required", {
      statusCode: 400,
      code: "MISSING_REFRESH_TOKEN",
    });
  }

  try {
    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshTokenPlain,
      user_type: "Location",
      redirect_uri: config.redirectUri,
    });

    const res = await axios.post(config.tokenUrl, body.toString(), {
      timeout: 15000,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const normalized = normalizeTokenResponse(res.data);
    if (!normalized.accessToken) {
      throw new GhlOAuthError("GHL refresh response missing access_token", {
        statusCode: 502,
        code: "INVALID_TOKEN_RESPONSE",
      });
    }

    return normalized;
  } catch (err) {
    if (err instanceof GhlOAuthError) throw err;
    console.error("GHL OAuth refresh failed:", sanitizeAxiosError(err));
    throw new GhlOAuthError("Failed to refresh GHL access token", {
      statusCode: 502,
      code: "TOKEN_REFRESH_FAILED",
    });
  }
}

async function revokeRefreshToken(refreshTokenPlain) {
  if (!refreshTokenPlain) return { revoked: false, skipped: true };

  const config = getOAuthConfig();
  try {
    await axios.post(
      config.tokenUrl,
      {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshTokenPlain,
        user_type: "Location",
        redirect_uri: config.redirectUri,
        revoke: true,
      },
      {
        timeout: 10000,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        validateStatus: (status) => status >= 200 && status < 500,
      },
    );
    return { revoked: true };
  } catch (err) {
    console.warn(
      "GHL OAuth revoke best-effort failed:",
      err.message || err,
    );
    return { revoked: false, error: err.message || String(err) };
  }
}

function toPublicConnectionStatus(connection) {
  if (!connection) {
    return {
      connected: false,
      status: "DISCONNECTED",
    };
  }

  return {
    connected: connection.status === "CONNECTED",
    status: connection.status,
    ghlLocationId: connection.ghlLocationId,
    ghlCompanyId: connection.ghlCompanyId || null,
    scopes: connection.scopes || [],
    connectedAt: connection.connectedAt,
    connectedByUserId: connection.connectedByUserId,
    tokenExpiresAt: connection.tokenExpiresAt,
    lastError: connection.lastError || null,
    updatedAt: connection.updatedAt,
  };
}

async function getOrganizationConnection(prisma, organizationId) {
  return prisma.organizationGhlConnection.findUnique({
    where: { organizationId },
  });
}

async function assertLocationAvailable(prisma, ghlLocationId, organizationId) {
  const existing = await prisma.organizationGhlConnection.findUnique({
    where: { ghlLocationId },
  });

  if (existing && existing.organizationId !== organizationId) {
    throw new GhlOAuthError(
      "This GoHighLevel location is already connected to another LendingCart organization",
      { statusCode: 409, code: "LOCATION_ALREADY_CONNECTED" },
    );
  }

  return existing;
}

async function saveOrganizationConnection(
  prisma,
  {
    organizationId,
    connectedByUserId,
    tokenPayload,
  },
) {
  const ghlLocationId = tokenPayload.locationId;
  await assertLocationAvailable(prisma, ghlLocationId, organizationId);

  const accessTokenEnc = encryptSecret(tokenPayload.accessToken);
  const refreshTokenEnc = tokenPayload.refreshToken
    ? encryptSecret(tokenPayload.refreshToken)
    : null;
  const tokenExpiresAt = computeTokenExpiresAt(tokenPayload.expiresIn);
  const now = new Date();

  const data = {
    ghlLocationId,
    ghlCompanyId: tokenPayload.companyId || null,
    accessToken: accessTokenEnc,
    refreshToken: refreshTokenEnc,
    tokenExpiresAt,
    scopes: tokenPayload.scopes,
    connectedAt: now,
    connectedByUserId: connectedByUserId || null,
    status: "CONNECTED",
    lastError: null,
  };

  return prisma.organizationGhlConnection.upsert({
    where: { organizationId },
    create: {
      organizationId,
      ...data,
    },
    update: data,
  });
}

async function ensureValidAccessToken(prisma, connection) {
  if (!connection) {
    throw new GhlOAuthError("GHL connection not found", {
      statusCode: 404,
      code: "NOT_CONNECTED",
    });
  }

  if (connection.status !== "CONNECTED") {
    throw new GhlOAuthError("GHL connection is not active", {
      statusCode: 409,
      code: "CONNECTION_INACTIVE",
    });
  }

  const expiresAt = connection.tokenExpiresAt
    ? new Date(connection.tokenExpiresAt).getTime()
    : null;
  const refreshThresholdMs = 5 * 60 * 1000;
  const needsRefresh =
    expiresAt != null && expiresAt - Date.now() <= refreshThresholdMs;

  if (!needsRefresh) {
    return {
      accessToken: decryptSecret(connection.accessToken),
      connection,
      refreshed: false,
    };
  }

  if (!connection.refreshToken) {
    throw new GhlOAuthError("GHL access token expired and no refresh token is stored", {
      statusCode: 409,
      code: "TOKEN_EXPIRED",
    });
  }

  const refreshTokenPlain = decryptSecret(connection.refreshToken);
  const refreshed = await refreshAccessToken(refreshTokenPlain);

  const updated = await prisma.organizationGhlConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encryptSecret(refreshed.accessToken),
      refreshToken: refreshed.refreshToken
        ? encryptSecret(refreshed.refreshToken)
        : connection.refreshToken,
      tokenExpiresAt: computeTokenExpiresAt(refreshed.expiresIn),
      scopes: refreshed.scopes.length ? refreshed.scopes : connection.scopes,
      ghlCompanyId: refreshed.companyId || connection.ghlCompanyId,
      ghlLocationId: refreshed.locationId || connection.ghlLocationId,
      status: "CONNECTED",
      lastError: null,
    },
  });

  return {
    accessToken: refreshed.accessToken,
    connection: updated,
    refreshed: true,
  };
}

async function disconnectOrganizationConnection(prisma, organizationId) {
  const existing = await prisma.organizationGhlConnection.findUnique({
    where: { organizationId },
  });

  if (!existing) {
    return { disconnected: false, existed: false };
  }

  if (existing.refreshToken) {
    try {
      const refreshTokenPlain = decryptSecret(existing.refreshToken);
      await revokeRefreshToken(refreshTokenPlain);
    } catch (err) {
      console.warn(
        "GHL disconnect revoke skipped:",
        err.message || err,
      );
    }
  }

  await prisma.organizationGhlConnection.delete({
    where: { id: existing.id },
  });

  return { disconnected: true, existed: true, ghlLocationId: existing.ghlLocationId };
}

module.exports = {
  GhlOAuthError,
  getOAuthConfig,
  isGhlOAuthConfigured,
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  refreshAccessToken,
  revokeRefreshToken,
  toPublicConnectionStatus,
  getOrganizationConnection,
  assertLocationAvailable,
  saveOrganizationConnection,
  ensureValidAccessToken,
  disconnectOrganizationConnection,
  computeTokenExpiresAt,
  parseScopes,
  normalizeTokenResponse,
};
