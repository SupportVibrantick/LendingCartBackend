const fp = require("fastify-plugin");
const jwt = require("jsonwebtoken");
const jwtSecret = require("../utils/auth/jwtSecret");

function verifyLoanAiPlugin(fastify, _opts, done) {
  fastify.decorate("verifyLoanAi", async function verifyLoanAi(request, reply) {
    try {
      const authHeader = request.headers.authorization || "";
      const header = String(authHeader).trim();
      const token = header.startsWith("Bearer ") ? header.slice(7).trim() : header;

      if (!token) {
        return reply.code(401).send({ success: false, message: "Authentication required" });
      }

      const decoded = jwt.verify(token, jwtSecret);

      if (decoded.aud !== "loan-ai-app") {
        return reply.code(401).send({ success: false, message: "Invalid token audience" });
      }

      if (!decoded.id || decoded.userType !== "LOAN_AI") {
        return reply.code(401).send({ success: false, message: "Invalid token payload" });
      }

      const user = await fastify.prisma.loanAiUser.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        return reply.code(401).send({ success: false, message: "User not found" });
      }

      request.loanAiUser = user;
      request.user = {
        id: user.id,
        userId: user.id,
        email: user.email,
        userType: "LOAN_AI",
      };
    } catch (err) {
      return reply.code(401).send({
        success: false,
        message: "Invalid or expired token",
      });
    }
  });

  done();
}

module.exports = fp(verifyLoanAiPlugin, { name: "verify-loan-ai" });
