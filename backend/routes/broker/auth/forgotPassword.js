const crypto = require("crypto");
const { findBrokerUserByEmail } = require("../../../utils/auth/findBrokerUserByEmail");
const {
  brokerForgotPasswordSchema,
} = require("../../../schemas/broker/auth/resetPassword.schema");
const { sendBrokerPasswordResetEmail } = require("../../../services/emails/brokerPasswordResetEmail");

const RESET_TOKEN_EXPIRY_MS =
  Number(process.env.PASSWORD_RESET_EXPIRY_HOURS || 1) * 60 * 60 * 1000;

const GENERIC_SUCCESS_MESSAGE =
  "If an account exists with that email, a password reset link has been sent.";

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function forgotPasswordRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Broker -> Auth"],
        summary: "Request broker dashboard password reset email",
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string", format: "email" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const parsed = brokerForgotPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message: parsed.error.issues[0]?.message || "Invalid email address",
          });
        }

        const { email } = parsed.data;
        const user = await findBrokerUserByEmail(prisma, email);

        if (user) {
          const token = crypto.randomBytes(32).toString("hex");
          const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

          await prisma.$transaction(async (tx) => {
            await tx.passwordResetToken.updateMany({
              where: {
                userId: user.id,
                usedAt: null,
              },
              data: {
                usedAt: new Date(),
              },
            });

            await tx.passwordResetToken.create({
              data: {
                userId: user.id,
                token,
                expiresAt,
              },
            });
          });

          await sendBrokerPasswordResetEmail({
            firstName: user.firstName,
            email: user.email,
            resetToken: token,
            prisma,
          });
        }

        return reply.send({
          success: true,
          message: GENERIC_SUCCESS_MESSAGE,
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message },
          "Broker forgot password error"
        );

        return reply.code(500).send({
          success: false,
          message: "Unable to process password reset request",
        });
      }
    }
  );
}

module.exports = forgotPasswordRoutes;
