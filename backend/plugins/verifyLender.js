// plugins/verifyLender.js
module.exports = async function verifyLender(fastify) {
  fastify.decorate("verifyLender", async function (req, reply) {
    if (!req.user || req.user.orgType !== "LENDER") {
      return reply.status(403).send({
        success: false,
        message: "Lender access only",
      });
    }
  });
};
