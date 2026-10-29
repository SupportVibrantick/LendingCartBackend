/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function clientValidateResetTokenRoute(fastify) {
  fastify.get(
    "/reset-password/validate",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "15 minutes",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message:
              "Too many attempts. Please try again after 15 minutes.",
          }),
        },
      },
      schema: {
        tags: ["Client Portal"],
        summary: "Validate client portal password reset token",
        querystring: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const token = String(req.query?.token || "").trim();

        if (!token) {
          return reply.code(400).send({
            success: false,
            message: "Reset token is required",
          });
        }

        const tokenRecord = await prisma.clientPortalPasswordResetToken.findFirst(
          {
            where: {
              token,
              usedAt: null,
              expiresAt: {
                gt: new Date(),
              },
            },
            include: {
              user: {
                select: {
                  email: true,
                  isActive: true,
                  isDeleted: true,
                },
              },
            },
          },
        );

        if (
          !tokenRecord ||
          !tokenRecord.user.isActive ||
          tokenRecord.user.isDeleted
        ) {
          return reply.send({
            success: true,
            data: {
              valid: false,
            },
          });
        }

        return reply.send({
          success: true,
          data: {
            valid: true,
            email: tokenRecord.user.email,
          },
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message },
          "Client portal validate reset token error",
        );

        return reply.code(500).send({
          success: false,
          message: "Unable to validate reset link",
        });
      }
    },
  );
}

module.exports = clientValidateResetTokenRoute;
