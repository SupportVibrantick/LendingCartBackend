const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  loanAiLoginSchema,
} = require("../../../../schemas/public/loanAi/auth.schema");
const { commonLogs } = require("../../../../services/logger/contextLogger");

function signLoanAiToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      userType: "LOAN_AI",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
      issuer: "lendingcart",
      audience: "loan-ai-app",
    },
  );
}

async function loanAiLoginRoutes(fastify) {
  fastify.post(
    "/",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many login attempts. Please try again later.",
          }),
        },
      },
      schema: {
        tags: ["Public -> Loan AI Auth"],
        summary: "Login to Loan AI marketing site",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const parsed = loanAiLoginSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Email and password are required",
          });
        }

        const { email, password } = parsed.data;

        const user = await prisma.loanAiUser.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });

        if (!user) {
          return reply.status(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return reply.status(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        await prisma.loanAiUser.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        const token = signLoanAiToken(user);

        const hasBrokerSubscription = Boolean(user.brokerOrganizationId);

        return reply.send({
          success: true,
          message: "Login successful",
          data: {
            token,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              hasBrokerSubscription,
            },
          },
        });
      } catch (err) {
        commonLogs.error("Loan AI login failed", err);
        return reply.status(500).send({
          success: false,
          message: err.message || "Login failed",
        });
      }
    },
  );
}

module.exports = loanAiLoginRoutes;
