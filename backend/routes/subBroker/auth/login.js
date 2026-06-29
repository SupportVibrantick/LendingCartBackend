const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { loginSchema } = require("../../../schemas/subBroker/auth/login.schema");

const prisma = require("../../../config/prisma");
const { ZodError } = require("zod");
const {
  resolveCoBrokerBranding,
} = require("../../../utils/resolveCoBrokerBranding");

const jwtSecret = process.env.JWT_SECRET || "SecretKey";

async function loginRoute(fastify, options) {
  fastify.post(
    "/login",

    async (request, reply) => {
      try {
        const validatedData = loginSchema.parse(request.body);

        const { email, password } = validatedData;

        // FIND USER
        const user = await prisma.userAccount.findFirst({
          where: {
            email,
            isDeleted: false,
          },

          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        });

        // USER NOT FOUND
        if (!user) {
          return reply.code(404).send({
            success: false,
            message: "Invalid credentials",
          });
        }

        // CHECK ROLE
        const isSubBroker = user.roles.some(
          (r) => r.role?.name === "SUB_BROKER",
        );

        if (!isSubBroker) {
          return reply.code(403).send({
            success: false,
            message: "Unauthorized access",
          });
        }

        // PASSWORD
        const isPasswordValid = await bcrypt.compare(
          password,
          user.passwordHash,
        );

        if (!isPasswordValid) {
          return reply.code(400).send({
            success: false,
            message: "Invalid credentials",
          });
        }

        // TOKEN
        const token = jwt.sign(
          {
            userId: user.id,

            roles: ["SUB_BROKER"],

            organizationId: user.organizationId || null,
          },

          jwtSecret,

          {
            expiresIn: "7d",
          },
        );

        const branding = await resolveCoBrokerBranding(
          prisma,
          user.id,
          user.organizationId || null,
        );

        return reply.code(200).send({
          success: true,

          token,

          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            organizationId: user.organizationId || null,
          },

          branding,
        });
      } catch (err) {
        // ZOD VALIDATION ERROR
        if (err instanceof ZodError) {
          return reply.code(400).send({
            success: false,
            message: "Validation failed",

            errors: err.errors.map((e) => ({
              field: e.path[0],
              message: e.message,
            })),
          });
        }

        console.error(err);

        return reply.code(500).send({
          success: false,
          message: err.message || "Something went wrong",
        });
      }
    },
  );
}

module.exports = loginRoute;
