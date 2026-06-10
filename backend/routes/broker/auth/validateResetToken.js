/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function validateResetTokenRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Auth"],
        summary: "Validate broker password reset token",
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
        const { token } = req.query;

        if (!token?.trim()) {
          return reply.code(400).send({
            success: false,
            message: "Reset token is required",
          });
        }

        const tokenRecord = await prisma.passwordResetToken.findFirst({
          where: {
            token: token.trim(),
            usedAt: null,
            expiresAt: {
              gt: new Date(),
            },
          },
          include: {
            user: {
              select: {
                email: true,
                status: true,
                isDeleted: true,
              },
            },
          },
        });

        if (!tokenRecord || tokenRecord.user.status !== "ACTIVE" || tokenRecord.user.isDeleted) {
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
          "Broker validate reset token error"
        );

        return reply.code(500).send({
          success: false,
          message: "Unable to validate reset link",
        });
      }
    }
  );
}

module.exports = validateResetTokenRoutes;
