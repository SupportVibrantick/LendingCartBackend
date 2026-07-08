// backend/middleware/fgaMiddleware.js
const { checkPermission } = require("../services/auth/fgaService.js");

module.exports = function registerFgaMiddleware(fastify, opts, done) {
  /**
   * fastify.requireFga(objectBuilderOrString, relation)
   * returns a preHandler that checks OpenFGA permission.
   *
   * objectBuilderOrString: (req) => "loan_application:123"  OR "loan_application:123"
   * relation: e.g. "read", "write"
   *
   * Usage:
   * preHandler: [ fastify.authenticate, fastify.requireFga(req => `loan_application:${req.params.id}`, 'read') ]
   */
  fastify.decorate("requireFga", (objectBuilder, relation) => {
    return async function (req, reply) {
      try {
        const userId = req.user && req.user.userId;
        if (!userId) {
          return reply.code(401).send({ ok: false, message: "Unauthorized" });
        }

        const object = typeof objectBuilder === "function" ? objectBuilder(req) : objectBuilder;
        if (!object) {
          // misconfigured route
          fastify.log.warn("requireFga called with empty object for check", { route: req.url });
          return reply.code(500).send({ ok: false, message: "Server authorization error" });
        }

        const allowed = await checkPermission(userId, object, relation);
        if (!allowed) {
          return reply.code(403).send({ ok: false, message: "Forbidden" });
        }

        // allowed -> continue
      } catch (err) {
        fastify.log.error("FGA check error:", err && err.message ? err.message : err);
        return reply.code(500).send({ ok: false, message: "Authorization check failed" });
      }
    };
  });

  done();
};
