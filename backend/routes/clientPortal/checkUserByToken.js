const jwt = require("jsonwebtoken");
const jwtSecret = require("../../utils/auth/jwtSecret");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function checkUserByTokenRoute(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Client Portal"],
        summary: "Check if client portal user exists (Token or JWT)",
        querystring: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        let clientId = null;
        let email = null;
        let userExists = false;

        /* ===============================
           CASE 1: TOKEN BASED
        =============================== */

        if (req.query.token) {
          const token = req.query.token;

          const tokenRecord = await prisma.clientUploadToken.findFirst({
            where: {
              token,
              isUsed: false,
              expiresAt: {
                gt: new Date(),
              },
            },
          });

          if (!tokenRecord) {
            return reply.code(404).send({
              success: false,
              message: "Invalid or expired access link",
            });
          }

          clientId = tokenRecord.clientId;
        } else if (req.headers.authorization) {

        /* ===============================
           CASE 2: JWT BASED
        =============================== */
          const authHeader = req.headers.authorization;

          const token = authHeader.split(" ")[1];

          const decoded = jwt.verify(token, jwtSecret);

          clientId = decoded.clientId;
        } else {

        /* ===============================
           NO AUTH PROVIDED
        =============================== */
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        /* ===============================
           GET EMAIL
        =============================== */

        const contact = await prisma.clientContact.findFirst({
          where: {
            clientId,
          },
          orderBy: {
            isPrimary: "desc",
          },
          select: {
            email: true,
          },
        });

        email = contact?.email || null;

        /* ===============================
           CHECK USER EXISTS
           Unique on email — also match by email so invite UI shows login
           when the client has already set a password (lastLoginAt set).

           Broker impersonation may auto-provision a portal row with a random
           hash and lastLoginAt=null; those must still see "Create Password".
        =============================== */

        const clientUser = await prisma.clientPortalUser.findFirst({
          where: {
            isDeleted: false,
            OR: [
              { clientId },
              ...(email
                ? [{ email: { equals: email, mode: "insensitive" } }]
                : []),
            ],
          },
          select: { id: true, lastLoginAt: true, clientId: true },
        });

        // Only treat as existing login account after the client has logged in
        // (or completed set-password → auto-login). Impersonation-only rows
        // stay on the set-password form for invite links.
        userExists = Boolean(clientUser?.lastLoginAt);

        /* ===============================
           RESPONSE
        =============================== */

        return reply.send({
          success: true,
          data: {
            userExists,
            email,
            clientId,
            tokenValid: true,
            needsPasswordSetup: Boolean(clientUser) && !clientUser.lastLoginAt,
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            query: req.query,
          },
          "Failed to check client user (hybrid)",
        );

        return reply.code(500).send({
          success: false,
          message: "Unexpected server error",
        });
      }
    },
  );
}

module.exports = checkUserByTokenRoute;
