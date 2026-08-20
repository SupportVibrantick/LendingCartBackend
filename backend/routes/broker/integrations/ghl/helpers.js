function requireBrokerAdmin(req, reply) {
  if (!req.user || req.user.orgType !== "BROKER") {
    reply.code(403).send({
      success: false,
      message: "Broker access only",
    });
    return false;
  }

  if (!req.user.roles?.includes("BROKER_ADMIN")) {
    reply.code(403).send({
      success: false,
      message: "Broker admin access required",
    });
    return false;
  }

  return true;
}

function requireBrokerUser(req, reply) {
  if (!req.user || req.user.orgType !== "BROKER") {
    reply.code(403).send({
      success: false,
      message: "Broker access only",
    });
    return false;
  }

  return true;
}

function getBrokerDashboardOrigin() {
  const candidates = [
    process.env.BROKER_DASHBOARD_URL,
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGINS,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    for (const part of String(raw).split(",")) {
      const trimmed = part.trim();
      if (!trimmed || trimmed === "*") continue;
      try {
        return new URL(trimmed).origin;
      } catch {
        // ignore invalid
      }
    }
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:5174";
  }

  return null;
}

function buildBrokerIntegrationRedirect({ success, code, message }) {
  const origin = getBrokerDashboardOrigin();
  if (!origin) {
    return null;
  }

  const url = new URL("/settings/integrations/ghl", origin);
  url.searchParams.set("ghl", success ? "connected" : "error");
  if (code) url.searchParams.set("code", code);
  if (message) url.searchParams.set("message", message.slice(0, 200));
  return url.toString();
}

module.exports = {
  requireBrokerAdmin,
  requireBrokerUser,
  getBrokerDashboardOrigin,
  buildBrokerIntegrationRedirect,
};
