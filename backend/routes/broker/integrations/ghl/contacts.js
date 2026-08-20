const {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
} = require("../../../../services/ghl/brokerGhlContacts.service");
const {
  toBrokerGhlErrorResponse,
  BROKER_GHL_ERROR_CODES,
} = require("../../../../services/ghl/brokerGhlErrors");
const {
  ghlContactCreateSchema,
  ghlContactUpdateSchema,
  ghlContactListQuerySchema,
} = require("../../../../schemas/broker/integrations/ghlContacts.schema");
const { requireBrokerUser } = require("./helpers");

function sendBrokerGhlError(reply, err) {
  const { statusCode, body } = toBrokerGhlErrorResponse(err);
  return reply.code(statusCode).send(body);
}

function getBrokerOrganizationId(req) {
  return req.user?.organizationId;
}

async function brokerGhlContactsRoutes(fastify) {
  fastify.get(
    "/contacts",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL Contacts"],
        summary: "List GoHighLevel contacts for the connected broker location",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
            query: { type: "string" },
            startAfterId: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      if (!requireBrokerUser(req, reply)) return;

      const parsed = ghlContactListQuerySchema.safeParse(req.query || {});
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          code: BROKER_GHL_ERROR_CODES.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message || "Invalid query",
        });
      }

      try {
        const result = await listContacts(
          fastify.prisma,
          getBrokerOrganizationId(req),
          parsed.data,
        );
        return reply.send({ success: true, data: result });
      } catch (err) {
        req.log.error(err, "Broker GHL list contacts failed");
        return sendBrokerGhlError(reply, err);
      }
    },
  );

  fastify.get(
    "/contacts/:contactId",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL Contacts"],
        summary: "Get a GoHighLevel contact by id",
      },
    },
    async (req, reply) => {
      if (!requireBrokerUser(req, reply)) return;

      try {
        const contact = await getContact(
          fastify.prisma,
          getBrokerOrganizationId(req),
          req.params.contactId,
        );
        return reply.send({ success: true, data: contact });
      } catch (err) {
        req.log.error(err, "Broker GHL get contact failed");
        return sendBrokerGhlError(reply, err);
      }
    },
  );

  fastify.post(
    "/contacts",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL Contacts"],
        summary: "Create a GoHighLevel contact in the connected broker location",
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            companyName: { type: "string" },
            source: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    async (req, reply) => {
      if (!requireBrokerUser(req, reply)) return;

      const parsed = ghlContactCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          code: BROKER_GHL_ERROR_CODES.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message || "Invalid contact payload",
        });
      }

      try {
        const contact = await createContact(
          fastify.prisma,
          getBrokerOrganizationId(req),
          parsed.data,
        );
        return reply.code(201).send({ success: true, data: contact });
      } catch (err) {
        req.log.error(err, "Broker GHL create contact failed");
        return sendBrokerGhlError(reply, err);
      }
    },
  );

  fastify.put(
    "/contacts/:contactId",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL Contacts"],
        summary: "Update a GoHighLevel contact",
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            companyName: { type: "string" },
            source: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    async (req, reply) => {
      if (!requireBrokerUser(req, reply)) return;

      const parsed = ghlContactUpdateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          code: BROKER_GHL_ERROR_CODES.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message || "Invalid contact payload",
        });
      }

      try {
        const contact = await updateContact(
          fastify.prisma,
          getBrokerOrganizationId(req),
          req.params.contactId,
          parsed.data,
        );
        return reply.send({ success: true, data: contact });
      } catch (err) {
        req.log.error(err, "Broker GHL update contact failed");
        return sendBrokerGhlError(reply, err);
      }
    },
  );

  fastify.delete(
    "/contacts/:contactId",
    {
      schema: {
        tags: ["Broker -> Integrations -> GHL Contacts"],
        summary: "Delete a GoHighLevel contact",
      },
    },
    async (req, reply) => {
      if (!requireBrokerUser(req, reply)) return;

      try {
        const result = await deleteContact(
          fastify.prisma,
          getBrokerOrganizationId(req),
          req.params.contactId,
        );
        return reply.send({ success: true, data: result });
      } catch (err) {
        req.log.error(err, "Broker GHL delete contact failed");
        return sendBrokerGhlError(reply, err);
      }
    },
  );
}

module.exports = brokerGhlContactsRoutes;
