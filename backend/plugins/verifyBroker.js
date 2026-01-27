module.exports = async function verifyBroker(fastify) {
  fastify.addHook("preHandler", async (req, reply) => {
    // Allow public routes
    if (!req.user) return;

    if (req.user.orgType !== "BROKER") {
      return reply.code(403).send({
        success: false,
        message: "Broker access only",
      });
    }
  });
};
