module.exports = async function submitApplication(fastify) {
  fastify.post("/:applicationId/submit", async (req, reply) => {
    reply.send({ success: true });
  });
};
