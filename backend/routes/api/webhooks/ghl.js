const {
  verifyGhlWebhookSignature,
} = require("../../../modules/ghl/ghl.webhook.verify");
const {
  processGhlWebhook,
  logGhlWebhookPayloadStructureDebug,
} = require("../../../services/ghl/ghlWebhookProcessor");
const {
  CHECKOUT_ERROR_CODES,
  USER_MESSAGES,
} = require("../../../services/ghl/ghlCheckoutErrors");
const {
  checkRateLimit,
  getClientIp,
} = require("../../../utils/security/rateLimit");
const {
  logWebhookFailed,
} = require("../../../services/ghl/ghlPaymentLogger");
const { commonLogs } = require("../../../services/logger/contextLogger");

async function ghlWebhookRoutes(fastify) {
  fastify.log.info(
    `GHL_WEBHOOK_PAYLOAD_DEBUG = ${process.env.GHL_WEBHOOK_PAYLOAD_DEBUG === "true"}`,
  );

  // Signature verification requires the exact raw body bytes.
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
        tags: ["Webhooks -> GHL"],
        summary: "Inbound GoHighLevel payment/subscription webhook",
      },
    },
    async (req, reply) => {
      const ip = getClientIp(req);
      const limit = checkRateLimit(`ghl-webhook:ip:${ip}`, {
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

      const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
      const verification = verifyGhlWebhookSignature(rawBody, req.headers);

      if (!verification.ok) {
        commonLogs.warn("GHL webhook signature rejected", {
          reason: verification.reason,
          ip,
        });
        return reply.code(401).send({
          success: false,
          message: "Invalid webhook signature",
        });
      }

      const body = req.body || {};

      if (process.env.GHL_WEBHOOK_PAYLOAD_DEBUG === "true") {
        logGhlWebhookPayloadStructureDebug(body);
      }

      try {
        const result = await processGhlWebhook(
          fastify.prisma,
          fastify.io,
          body,
        );

        if (result.duplicate) {
          // Duplicate already logged inside processGhlWebhook
          return reply.send({
            success: true,
            code: CHECKOUT_ERROR_CODES.DUPLICATE_WEBHOOK,
            message: USER_MESSAGES[CHECKOUT_ERROR_CODES.DUPLICATE_WEBHOOK],
            data: {
              duplicate: true,
              status: result.status,
              action: result.action || null,
              webhookId: result.webhookId,
            },
          });
        }

        return reply.send({
          success: true,
          data: {
            duplicate: false,
            status: result.status,
            action: result.action || null,
            webhookId: result.webhookId,
          },
        });
      } catch (err) {
        // Failure already logged inside processGhlWebhook when event row exists;
        // log here for signature-passed but early/unexpected failures.
        if (!err?.loggedAsWebhookFailure) {
          logWebhookFailed({
            message: err.message,
            eventType: body.type || body.event || body.eventType || null,
          });
        }
        return reply.code(500).send({
          success: false,
          code: CHECKOUT_ERROR_CODES.WEBHOOK_FAILED,
          message: USER_MESSAGES[CHECKOUT_ERROR_CODES.WEBHOOK_FAILED],
        });
      }
    },
  );
}

module.exports = ghlWebhookRoutes;
