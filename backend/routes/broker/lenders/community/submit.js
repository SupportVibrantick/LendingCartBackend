/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function submitCommunityLenderRoutes(fastify) {
  fastify.post(
    "/submit",
    {
      schema: {
        tags: ["Broker -> Lenders -> Community"],
        summary: "Add your own lender — create org, profile, and send invite",
        body: {
          type: "object",
          required: [
            "companyName",
            "businessEmail",
            "contactPerson",
            "phone",
          ],
          additionalProperties: false,
          properties: {
            companyName: { type: "string", minLength: 1 },
            businessEmail: { type: "string", format: "email" },
            contactPerson: { type: "string", minLength: 1 },
            phone: { type: "string", minLength: 10 },
            website: { type: "string" },
            notes: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      if (!req.user?.organizationId) {
        return reply.code(403).send({ success: false, message: "Unauthorized" });
      }

      const {
        validateSubmitPayload,
        submitBrokerLender,
      } = require("../../../../services/lenderInvites/brokerLenderSubmission");

      const { errors, data } = validateSubmitPayload(req.body);
      if (errors.length) {
        return reply.code(400).send({
          success: false,
          message: errors.join("; "),
        });
      }

      try {
        const submission = await submitBrokerLender(prisma, {
          ...data,
          brokerOrgId: req.user.organizationId,
          brokerUserId: req.user.id || req.user.userId,
        });

        return reply.code(201).send({
          success: true,
          message: "Invitation sent successfully",
          data: submission,
        });
      } catch (err) {
        if (err.code === "DUPLICATE") {
          return reply.code(409).send({
            success: false,
            message: err.message,
            code: "DUPLICATE",
            duplicate: err.duplicate,
          });
        }
        req.log.error(err);
        return reply.code(500).send({
          success: false,
          message: err.message || "Failed to submit lender",
        });
      }
    },
  );
}

module.exports = submitCommunityLenderRoutes;
