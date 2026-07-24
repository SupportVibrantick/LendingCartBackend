const {
  getBrokerLoiPrefill,
  getBrokerLoiStatus,
  generateBrokerLoi,
  sendBrokerLoiToClient,
  forwardBrokerLoiToLender,
} = require("../../../../utils/broker/brokerLoiService");

function createBrokerLoiRoutes({ tagPrefix, requireBrokerUserId = false }) {
  return async function brokerLoiRoutes(fastify) {
    const resolveBrokerUserId = (req) =>
      requireBrokerUserId ? req.user.id || req.user.userId : null;
    fastify.get(
      "/:applicationId/broker-loi",
      {
        schema: {
          tags: [`${tagPrefix} -> Broker LOI`],
          summary: "Get broker LOI status for an application",
        },
      },
      async (req, reply) => {
        try {
          if (!req.user?.organizationId) {
            return reply.code(403).send({ success: false, message: "Access denied" });
          }

          const result = await getBrokerLoiStatus(fastify.prisma, {
            applicationId: req.params.applicationId,
            brokerOrgId: req.user.organizationId,
            brokerUserId: requireBrokerUserId
              ? req.user.id || req.user.userId
              : null,
          });

          if (result.error) {
            return reply.code(result.error.status).send({
              success: false,
              message: result.error.message,
            });
          }

          return reply.send({ success: true, data: result.data });
        } catch (error) {
          fastify.log.error(error);
          return reply.code(500).send({
            success: false,
            message: error.message || "Failed to fetch broker LOI",
          });
        }
      },
    );

    fastify.get(
      "/:applicationId/broker-loi/prefill",
      {
        schema: {
          tags: [`${tagPrefix} -> Broker LOI`],
          summary: "Prefill broker LOI terms from a selected lender LOI",
          querystring: {
            type: "object",
            required: ["sourceApplicationLenderId"],
            properties: {
              sourceApplicationLenderId: { type: "string" },
            },
          },
        },
      },
      async (req, reply) => {
        try {
          if (!req.user?.organizationId) {
            return reply.code(403).send({ success: false, message: "Access denied" });
          }

          const result = await getBrokerLoiPrefill(fastify.prisma, {
            applicationId: req.params.applicationId,
            sourceApplicationLenderId: req.query.sourceApplicationLenderId,
            brokerOrgId: req.user.organizationId,
            brokerUserId: requireBrokerUserId
              ? req.user.id || req.user.userId
              : null,
          });

          if (result.error) {
            return reply.code(result.error.status).send({
              success: false,
              message: result.error.message,
            });
          }

          return reply.send({ success: true, data: result.data });
        } catch (error) {
          fastify.log.error(error);
          return reply.code(500).send({
            success: false,
            message: error.message || "Failed to prefill broker LOI",
          });
        }
      },
    );

    fastify.post(
      "/:applicationId/broker-loi/generate",
      {
        schema: {
          tags: [`${tagPrefix} -> Broker LOI`],
          summary: "Generate broker-branded LOI PDF from selected lender LOI",
          body: {
            type: "object",
            required: ["sourceApplicationLenderId", "brokerTerms"],
            properties: {
              sourceApplicationLenderId: { type: "string" },
              brokerTerms: { type: "object" },
              branding: {
                type: "object",
                properties: {
                  brandName: { type: "string" },
                  logoUrl: { type: "string" },
                },
              },
            },
          },
        },
      },
      async (req, reply) => {
        try {
          if (!req.user?.organizationId) {
            return reply.code(403).send({ success: false, message: "Access denied" });
          }

          const result = await generateBrokerLoi(fastify.prisma, {
            applicationId: req.params.applicationId,
            sourceApplicationLenderId: req.body.sourceApplicationLenderId,
            brokerTerms: req.body.brokerTerms,
            branding: req.body.branding,
            brokerOrgId: req.user.organizationId,
            brokerUserId: requireBrokerUserId
              ? req.user.id || req.user.userId
              : null,
            userId: req.user.id || req.user.userId,
          });

          if (result.error) {
            return reply.code(result.error.status).send({
              success: false,
              message: result.error.message,
            });
          }

          return reply.send({
            success: true,
            message: "Broker LOI generated successfully",
            data: result.data,
          });
        } catch (error) {
          fastify.log.error(error);
          return reply.code(500).send({
            success: false,
            message: error.message || "Failed to generate broker LOI",
          });
        }
      },
    );

    fastify.post(
      "/:applicationId/broker-loi/send-to-client",
      {
        schema: {
          tags: [`${tagPrefix} -> Broker LOI`],
          summary: "Send broker LOI to client for signature",
        },
      },
      async (req, reply) => {
        try {
          if (!req.user?.organizationId) {
            return reply.code(403).send({ success: false, message: "Access denied" });
          }

          const result = await sendBrokerLoiToClient(fastify.prisma, fastify.io, {
            applicationId: req.params.applicationId,
            brokerOrgId: req.user.organizationId,
            brokerUserId: resolveBrokerUserId(req),
            brokerUser: req.user,
          });

          if (result.error) {
            return reply.code(result.error.status).send({
              success: false,
              message: result.error.message,
            });
          }

          return reply.send({
            success: true,
            message: "Broker LOI sent to client for signature",
            data: result.data,
          });
        } catch (error) {
          fastify.log.error(error);
          return reply.code(500).send({
            success: false,
            message: error.message || "Failed to send broker LOI to client",
          });
        }
      },
    );

    fastify.post(
      "/:applicationId/broker-loi/forward-to-lender",
      {
        schema: {
          tags: [`${tagPrefix} -> Broker LOI`],
          summary: "Forward client-signed broker LOI to funding lender",
        },
      },
      async (req, reply) => {
        try {
          if (!req.user?.organizationId) {
            return reply.code(403).send({ success: false, message: "Access denied" });
          }

          const result = await forwardBrokerLoiToLender(
            fastify.prisma,
            fastify.io,
            {
              applicationId: req.params.applicationId,
              brokerOrgId: req.user.organizationId,
              brokerUserId: resolveBrokerUserId(req),
            },
          );

          if (result.error) {
            return reply.code(result.error.status).send({
              success: false,
              message: result.error.message,
            });
          }

          return reply.send({
            success: true,
            message: "Signed broker LOI forwarded to lender",
            data: result.data,
          });
        } catch (error) {
          fastify.log.error(error);
          return reply.code(500).send({
            success: false,
            message: error.message || "Failed to forward broker LOI to lender",
          });
        }
      },
    );
  };
}

module.exports = createBrokerLoiRoutes;
