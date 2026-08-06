/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const { requireLoAddOwnLender } = require("../../../../services/broker/loanOfficerAccess");

async function checkDuplicateRoutes(fastify) {
  fastify.post(
    "/check-duplicate",
    {
      schema: {
        tags: ["Broker -> Lenders -> Community"],
        summary: "Check if a lender already exists before submission",
        body: {
          type: "object",
          required: ["companyName", "businessEmail"],
          properties: {
            companyName: { type: "string" },
            businessEmail: { type: "string", format: "email" },
            website: { type: "string" },
          },
        },
      },
      preHandler: async (req, reply) => {
        await requireLoAddOwnLender(req, reply, fastify);
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      if (!req.user?.organizationId) {
        return reply.code(403).send({ success: false, message: "Unauthorized" });
      }

      const { findDuplicateLender } = require("../../../../services/lenderInvites/brokerLenderDuplicateCheck");

      const result = await findDuplicateLender(
        prisma,
        {
          companyName: req.body.companyName,
          businessEmail: req.body.businessEmail,
          website: req.body.website,
        },
        req.user.organizationId,
      );

      return reply.send({ success: true, ...result });
    },
  );
}

module.exports = checkDuplicateRoutes;
