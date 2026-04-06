const jwt = require("jsonwebtoken");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getClientApplicationDetailsRoute(fastify) {
  fastify.get("/applications/:id", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      /* ===============================
         AUTH
      =============================== */
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.code(401).send({ success: false, message: "Unauthorized" });
      }

      const token = authHeader.split(" ")[1];

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return reply.code(401).send({ success: false, message: "Invalid token" });
      }

      if (!decoded.clientId || decoded.role !== "CLIENT") {
        return reply.code(403).send({ success: false, message: "Access denied" });
      }

      const clientId = decoded.clientId;
      const applicationId = req.params.id;

      /* ===============================
         FETCH FULL DATA (ALL FIELDS)
      =============================== */
      const application = await prisma.loanApplication.findFirst({
        where: {
          id: applicationId,
          clientId,
        },
        include: {
          submissions: {
            include: {
              fields: true,
            },
          },
          documentRequirements: {
            include: {
              documentType: true,
              uploads: true,
            },
          },
          collaterals: true,
          financials: true,
          statusHistory: true,
          client: true,
          brokerOrg: true,
          applicationLenders: true,
        },
      });

      if (!application) {
        return reply.code(404).send({
          success: false,
          message: "Application not found",
        });
      }

      /* ===============================
         RETURN EVERYTHING (NO FILTER)
      =============================== */
      return reply.send({
        success: true,
        data: application,
      });

    } catch (error) {
      fastify.log.error({ error: error.message }, "Fetch failed");

      return reply.code(500).send({
        success: false,
        message: "Unexpected server error",
      });
    }
  });
}

module.exports = getClientApplicationDetailsRoute;