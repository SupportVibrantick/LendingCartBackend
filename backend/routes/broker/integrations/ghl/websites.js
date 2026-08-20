const {
  listWebsites,
  getWebsite,
  listWebsitePages,
  getWebsitePage,
  GHL_WEBSITE_CAPABILITIES,
} = require("../../../../services/ghl/brokerGhlWebsites.service");
const {
  toBrokerGhlErrorResponse,
  BROKER_GHL_ERROR_CODES,
} = require("../../../../services/ghl/brokerGhlErrors");
const {
  ghlWebsiteListQuerySchema,
  ghlWebsitePageListQuerySchema,
} = require("../../../../schemas/broker/integrations/ghlWebsites.schema");
const { requireBrokerUser } = require("./helpers");

function sendBrokerGhlError(reply, err) {
  const { statusCode, body } = toBrokerGhlErrorResponse(err);
  return reply.code(statusCode).send(body);
}

function getBrokerOrganizationId(req) {
  return req.user?.organizationId;
}

async function brokerGhlWebsitesRoutes(fastify) {
  fastify.get(
    "/capabilities",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL Websites"],
        summary: "Supported GHL website/funnel capabilities for this integration",
      },
    },
    async (req, reply) => {
      if (!requireBrokerUser(req, reply)) return;
      return reply.send({
        success: true,
        data: {
          capabilities: GHL_WEBSITE_CAPABILITIES,
          note: "Website create/edit, templates, and publishing are managed in GoHighLevel.",
        },
      });
    },
  );

  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL Websites"],
        summary: "List GoHighLevel websites (funnels) for the connected broker location",
      },
    },
    async (req, reply) => {
      if (!requireBrokerUser(req, reply)) return;

      const parsed = ghlWebsiteListQuerySchema.safeParse(req.query || {});
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          code: BROKER_GHL_ERROR_CODES.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message || "Invalid query",
        });
      }

      try {
        const data = await listWebsites(
          fastify.prisma,
          getBrokerOrganizationId(req),
          parsed.data,
        );
        return reply.send({ success: true, data });
      } catch (err) {
        req.log.error(err, "Broker GHL list websites failed");
        return sendBrokerGhlError(reply, err);
      }
    },
  );

  fastify.get(
    "/:websiteId",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL Websites"],
        summary: "Get a GoHighLevel website (funnel) by id",
      },
    },
    async (req, reply) => {
      if (!requireBrokerUser(req, reply)) return;

      try {
        const data = await getWebsite(
          fastify.prisma,
          getBrokerOrganizationId(req),
          req.params.websiteId,
        );
        return reply.send({ success: true, data });
      } catch (err) {
        req.log.error(err, "Broker GHL get website failed");
        return sendBrokerGhlError(reply, err);
      }
    },
  );

  fastify.get(
    "/:websiteId/pages",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL Websites"],
        summary: "List pages for a GoHighLevel website (funnel)",
      },
    },
    async (req, reply) => {
      if (!requireBrokerUser(req, reply)) return;

      const parsed = ghlWebsitePageListQuerySchema.safeParse(req.query || {});
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          code: BROKER_GHL_ERROR_CODES.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message || "Invalid query",
        });
      }

      try {
        const data = await listWebsitePages(
          fastify.prisma,
          getBrokerOrganizationId(req),
          req.params.websiteId,
          parsed.data,
        );
        return reply.send({ success: true, data });
      } catch (err) {
        req.log.error(err, "Broker GHL list website pages failed");
        return sendBrokerGhlError(reply, err);
      }
    },
  );

  fastify.get(
    "/:websiteId/pages/:pageId",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL Websites"],
        summary: "Get a GoHighLevel website page by id",
      },
    },
    async (req, reply) => {
      if (!requireBrokerUser(req, reply)) return;

      try {
        const data = await getWebsitePage(
          fastify.prisma,
          getBrokerOrganizationId(req),
          req.params.websiteId,
          req.params.pageId,
        );
        return reply.send({ success: true, data });
      } catch (err) {
        req.log.error(err, "Broker GHL get website page failed");
        return sendBrokerGhlError(reply, err);
      }
    },
  );
}

module.exports = brokerGhlWebsitesRoutes;
