// backend/routes/broker/auth/login.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const {
  brokerLoginSchema,
} = require("../../../schemas/broker/auth/login.schema");

const { brokerLogs } = require("../../../services/logger/contextLogger");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "refreshsecret";
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || "7d";

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function brokerLoginRoutes(fastify) {
  fastify.post(
    "/login",
    {
      schema: {
        tags: ["Broker -> Auth"],
        summary: "Broker login",
        description: "Login for broker admin/officer users",
      },
    },
    async (request, reply) => {
      try {
        // Validate input
        const parsed = brokerLoginSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid login payload",
          });
        }

        const { email, password } = parsed.data;

        // Find user
        const user = await prisma.userAccount.findFirst({
          where: {
            email,
            isDeleted: false,
            organization: {
              type: "BROKER",
              status: "ACTIVE",
              isDeleted: false,
            },
          },
          include: {
            organization: true,
            roles: {
              include: { role: true },
            },
          },
        });

        if (!user) {
          return reply.status(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          return reply.status(401).send({
            success: false,
            message: "Invalid email or password",
          });
        }

        //  Ensure broker role
        const hasBrokerRole = user.roles.some((r) =>
          ["BROKER_ADMIN", "BROKER_OFFICER"].includes(r.role.name)
        );

        if (!hasBrokerRole) {
          return reply.status(403).send({
            success: false,
            message: "Access denied for this account",
          });
        }

        // Generate tokens
        const payload = {
          userId: user.id,
          organizationId: user.organizationId,
          orgType: "BROKER",
          roles: user.roles.map((r) => r.role.name),
        };

        const accessToken = jwt.sign(payload, JWT_SECRET, {
          expiresIn: JWT_EXPIRES_IN,
        });

        const refreshToken = jwt.sign(payload, REFRESH_SECRET, {
          expiresIn: REFRESH_EXPIRES_IN,
        });

        brokerLogs.info("Broker logged in", {
          userId: user.id,
          organizationId: user.organizationId,
        });

        return reply.send({
          success: true,
          message: "Login successful",
          data: {
            accessToken,
            refreshToken,
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              roles: payload.roles,
              organization: {
                id: user.organization.id,
                name: user.organization.name,
                type: user.organization.type,
              },
            },
          },
        });
      } catch (err) {
        brokerLogs.error("Broker login failed", err);
        return reply.status(500).send({
          success: false,
          message: "Server error during login",
        });
      }
    }
  );
}

module.exports = brokerLoginRoutes;
