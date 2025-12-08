const fp = require("fastify-plugin");

module.exports = fp(function (fastify, opts, done) {
  fastify.decorate("verifySuperAdmin", async function (req, reply) {
    if (!req.user) return reply.code(401).send({ message: "Unauthorized" });

    const isAdmin = req.user.roles?.includes("PLATFORM_ADMIN");
    if (!isAdmin) return reply.code(403).send({ message: "Forbidden – Only Super Admin" });
  });

  done();
});
