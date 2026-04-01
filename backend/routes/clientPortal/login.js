const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function clientLoginRoute(fastify) {
  fastify.post(
    "/login",
    {
      schema: {
        tags: ["Client Portal"],
        summary: "Client login",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 6 },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        let { email, password } = req.body;

        /* ===============================
           NORMALIZE INPUT
        =============================== */

        email = email.toLowerCase().trim();

        /* ===============================
           FIND USER
        =============================== */

        const user = await prisma.clientPortalUser.findUnique({
          where: { email },
        });

        /* ===============================
           DUMMY HASH (ANTI-TIMING ATTACK)
        =============================== */

        const dummyHash =
          "$2b$10$CwTycUXWue0Thq9StjUM0uJ8GqzGwdrDam6DCQE4k74vNysGEKMlu";

        const passwordHash = user?.passwordHash || dummyHash;

        const isMatch = await bcrypt.compare(password, passwordHash);

        /* ===============================
           INVALID LOGIN
        =============================== */

        if (!user || user.isDeleted || !isMatch) {
          return reply.code(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        /* ===============================
           OPTIONAL ACCOUNT CHECKS
        =============================== */

        if (user.isActive === false) {
          return reply.code(403).send({
            success: false,
            message: "Account is disabled. Contact support.",
          });
        }

        /* ===============================
           GENERATE JWT
        =============================== */

        const token = jwt.sign(
          {
            id: user.id,
            clientId: user.clientId,
            role: "CLIENT",
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "7d",
            issuer: "your-app-name",
          }
        );

        /* ===============================
           UPDATE LAST LOGIN
        =============================== */

        await prisma.clientPortalUser.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
          },
        });

        /* ===============================
           SUCCESS RESPONSE
        =============================== */

        return reply.send({
          success: true,
          message: "Login successful",
          data: {
            token,
            user: {
              id: user.id,
              email: user.email,
              clientId: user.clientId,
            },
          },
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
          },
          "Client login failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Unexpected server error",
        });
      }
    }
  );
}

module.exports = clientLoginRoute;