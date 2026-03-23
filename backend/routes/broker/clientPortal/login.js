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
            email: { type: "string" },
            password: { type: "string" },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const { email, password } = req.body;

        /* ===============================
           FIND USER
        =============================== */

        const user = await prisma.clientPortalUser.findUnique({
          where: { email },
        });

        if (!user || user.isDeleted) {
          return reply.code(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        /* ===============================
           CHECK PASSWORD
        =============================== */

        const isMatch = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!isMatch) {
          return reply.code(401).send({
            success: false,
            message: "Invalid email or password",
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
          { expiresIn: "7d" }
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
           RESPONSE
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
            body: req.body,
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