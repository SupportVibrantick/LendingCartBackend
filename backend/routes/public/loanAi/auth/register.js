const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  loanAiRegisterSchema,
} = require("../../../../schemas/public/loanAi/auth.schema");
const { commonLogs } = require("../../../../services/logger/contextLogger");
const {
  notifyPlatform,
  PLATFORM_NOTIFICATION_EVENTS,
} = require("../../../../services/notifications/platformNotifications");

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

async function loanAiRegisterRoutes(fastify) {
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
            message: "Too many registration attempts. Please try again later.",
          }),
        },
      },
      schema: {
        tags: ["Public -> Loan AI Auth"],
        summary: "Register a Loan AI marketing-site account",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const parsed = loanAiRegisterSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message:
              parsed.error.issues[0]?.message || "Invalid registration data",
          });
        }

        const { firstName, lastName, email, password } = parsed.data;

        const existing = await prisma.loanAiUser.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });

        if (existing) {
          return reply.status(409).send({
            success: false,
            message: "An account with this email already exists",
          });
        }

        const brokerExists = await prisma.userAccount.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });

        if (brokerExists) {
          return reply.status(409).send({
            success: false,
            message:
              "This email is already used for a broker account. Sign in to the broker dashboard instead.",
          });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.loanAiUser.create({
          data: {
            email,
            passwordHash,
            firstName,
            lastName,
          },
        });

        const token = signLoanAiToken(user);

        try {
          const leadName = [firstName, lastName].filter(Boolean).join(" ").trim();
          await notifyPlatform(prisma, fastify.io, {
            eventType: PLATFORM_NOTIFICATION_EVENTS.LANDING_PAGE_LEAD,
            category: "LEAD",
            subject: "New Loan AI account registration",
            body: leadName
              ? `${leadName} registered on Loan AI (${email})`
              : `New Loan AI signup: ${email}`,
            metadata: {
              loanAiUserId: user.id,
              firstName,
              lastName,
              email,
              source: "loan-ai-register",
            },
          });
        } catch (notifyErr) {
          commonLogs.warn("Loan AI register notification failed", {
            error: notifyErr.message,
          });
        }

        return reply.status(201).send({
          success: true,
          message: "Account created successfully",
          data: {
            token,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              hasBrokerSubscription: Boolean(user.brokerOrganizationId),
            },
          },
        });
      } catch (err) {
        commonLogs.error("Loan AI register failed", err);
        return reply.status(500).send({
          success: false,
          message: err.message || "Registration failed",
        });
      }
    },
  );
}

module.exports = loanAiRegisterRoutes;
