const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { resolveClientDisplayName } = require("../../utils/applications/resolveClientDisplayName");

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
           FIND USER (SAFE)
        =============================== */
     const user = await prisma.clientPortalUser.findFirst({
  where: {
    email,
    isDeleted: false,
  },
  include: {
    client: {
      include: {
        contacts: {
          where: {
            isPrimary: true,
          },
          take: 1,
        },
      },
    },
  },
});

        /* ===============================
           DUMMY HASH (ANTI-TIMING)
        =============================== */
        const dummyHash =
          "$2b$10$CwTycUXWue0Thq9StjUM0uJ8GqzGwdrDam6DCQE4k74vNysGEKMlu";

        const passwordHash = user?.passwordHash || dummyHash;

        const isMatch = await bcrypt.compare(password, passwordHash);

        /* ===============================
           INVALID LOGIN
        =============================== */
        if (!user || !isMatch) {
          return reply.code(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        /* ===============================
           ACCOUNT CHECK
        =============================== */
        if (!user.isActive) {
          return reply.code(403).send({
            success: false,
            message: "Account is disabled",
          });
        }

        const clientName = await resolveClientDisplayName(prisma, {
          clientId: user.clientId,
          client: user.client,
          contacts: user.client?.contacts || [],
        });

        /* ===============================
           GENERATE JWT (KEEP jsonwebtoken)
        =============================== */
const token = jwt.sign(
  {
    id: user.id,
    clientId: user.clientId,

    email: user.email,
    clientEmail: user.email,

    clientName,
    role: "CLIENT",
    orgType: "CLIENT",
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "7d",
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
              clientName,
            },
          },
        });

      } catch (error) {
        fastify.log.error(
          { error: error.message },
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