const {
  constructStripeWebhookEvent,
  isStripeConfigured,
} = require("../../../services/stripe/stripeBilling");
const {
  processStripeWebhookEvent,
} = require("../../../services/stripe/stripeWebhookProcessor");
const { commonLogs } = require("../../../services/logger/contextLogger");
const {
  checkRateLimit,
  getClientIp,
} = require("../../../utils/security/rateLimit");

async function stripeWebhookRoutes(fastify) {
  // Stripe signature verification needs the exact raw body bytes.
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      try {
        req.rawBody = body;
        const text = body?.length ? body.toString("utf8") : "{}";
        done(null, text ? JSON.parse(text) : {});
      } catch (err) {
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  fastify.post(
    "/",
    {
      schema: {
        tags: ["Webhooks -> Stripe"],
        summary:
          "Inbound Stripe webhook (subscription deleted → lock CLM access)",
      },
    },
    async (req, reply) => {
      const ip = getClientIp(req);
      const limit = await checkRateLimit(`stripe-webhook:ip:${ip}`, {
        windowMs: 60 * 1000,
        max: 120,
      });
      if (!limit.allowed) {
        return reply.status(429).send({
          success: false,
          message: "Too many webhook requests",
          retryAfterSec: limit.retryAfterSec,
        });
      }

      if (!isStripeConfigured()) {
        return reply.code(503).send({
          success: false,
          message: "Stripe is not configured",
        });
      }

      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return reply.code(400).send({
          success: false,
          message: "Missing stripe-signature header",
        });
      }

      let event;
      try {
        const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
        event = constructStripeWebhookEvent(rawBody, signature);
      } catch (err) {
        commonLogs.warn("Stripe webhook signature rejected", {
          error: err?.message,
          ip,
        });
        return reply.code(400).send({
          success: false,
          message: "Invalid Stripe webhook signature",
        });
      }

      try {
        const result = await processStripeWebhookEvent(fastify.prisma, event);
        return reply.send({
          success: true,
          received: true,
          type: event.type,
          data: result,
        });
      } catch (err) {
        commonLogs.error("Stripe webhook processing failed", {
          type: event?.type,
          error: err?.message,
        });
        return reply.code(500).send({
          success: false,
          message: "Webhook processing failed",
        });
      }
    },
  );
}

module.exports = stripeWebhookRoutes;
