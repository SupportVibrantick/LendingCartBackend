const {
  createAndSendEmailVerification,
} = require("../../../services/auth/emailVerification");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderVerifyEmailRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender -> Auth"],
        summary: "Verify lender email with token",
        body: {
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
      const token = String(req.body?.token || "").trim();

      if (!token) {
        return reply.status(400).send({
          success: false,
          message: "Verification token is required",
        });
      }

      const record = await prisma.emailVerificationToken.findUnique({
        where: { token },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              emailVerifiedAt: true,
              isDeleted: true,
              status: true,
            },
          },
        },
      });

      if (!record || record.user?.isDeleted) {
        return reply.status(404).send({
          success: false,
          message: "Invalid verification link",
          code: "NOT_FOUND",
        });
      }

      if (record.usedAt) {
        return reply.send({
          success: true,
          message: "Email already verified",
          data: { alreadyVerified: true },
        });
      }

      if (record.expiresAt.getTime() < Date.now()) {
        return reply.status(400).send({
          success: false,
          message: "Verification link has expired",
          code: "EXPIRED",
        });
      }

      if (record.user.emailVerifiedAt) {
        await prisma.emailVerificationToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        });
        return reply.send({
          success: true,
          message: "Email already verified",
          data: { alreadyVerified: true },
        });
      }

      await prisma.$transaction([
        prisma.userAccount.update({
          where: { id: record.userId },
          data: { emailVerifiedAt: new Date() },
        }),
        prisma.emailVerificationToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        }),
      ]);

      return reply.send({
        success: true,
        message: "Email verified successfully",
        data: {
          email: record.user.email,
          alreadyVerified: false,
        },
      });
    },
  );

  fastify.post(
    "/resend",
    {
      schema: {
        tags: ["Lender -> Auth"],
        summary: "Resend lender email verification",
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
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();

      if (!email) {
        return reply.status(400).send({
          success: false,
          message: "Email is required",
        });
      }

      const user = await prisma.userAccount.findFirst({
        where: { email, isDeleted: false },
        include: {
          organization: { select: { type: true } },
        },
      });

      // Avoid account enumeration
      if (!user || user.organization?.type !== "LENDER") {
        return reply.send({
          success: true,
          message: "If that account exists, a verification email was sent",
        });
      }

      if (user.emailVerifiedAt) {
        return reply.send({
          success: true,
          message: "Email is already verified",
          data: { alreadyVerified: true },
        });
      }

      try {
        await createAndSendEmailVerification(prisma, user);
      } catch (err) {
        req.log.error(err, "Resend verification email failed");
        return reply.status(500).send({
          success: false,
          message: "Failed to send verification email",
        });
      }

      return reply.send({
        success: true,
        message: "If that account exists, a verification email was sent",
      });
    },
  );
}

module.exports = lenderVerifyEmailRoutes;
