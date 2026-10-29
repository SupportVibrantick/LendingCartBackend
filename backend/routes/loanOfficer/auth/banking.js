const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");
const {
  formatOwnBanking,
  getOwnBanking,
  upsertOwnBanking,
} = require("../../../services/broker/selfBankingProfile.service");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function loanOfficerBankingRoutes(fastify) {
  fastify.get(
    "/banking",
    {
      preHandler: officerPreHandler(fastify),
      schema: {
        tags: ["Loan Officer -> Auth"],
        summary: "Get own banking details for commission payouts",
      },
    },
    async (req, reply) => {
      const userId = req.user.userId || req.user.id;
      const profile = await getOwnBanking(fastify.prisma, userId);
      return reply.send({
        ok: true,
        success: true,
        data: { banking: formatOwnBanking(profile) },
      });
    },
  );

  fastify.put(
    "/banking",
    {
      preHandler: officerPreHandler(fastify),
      schema: {
        tags: ["Loan Officer -> Auth"],
        summary: "Add or update own banking details for commission payouts",
        body: { type: "object", additionalProperties: true },
      },
    },
    async (req, reply) => {
      try {
        const userId = req.user.userId || req.user.id;
        const profile = await upsertOwnBanking(
          fastify.prisma,
          userId,
          req.body || {},
        );
        return reply.send({
          ok: true,
          success: true,
          message: "Banking details saved. Future commission ACH will use this account",
          data: { banking: formatOwnBanking(profile) },
        });
      } catch (error) {
        const statusCode = error.statusCode || 400;
        return reply.code(statusCode).send({
          ok: false,
          success: false,
          message: error.message || "Failed to save banking details",
        });
      }
    },
  );
};
