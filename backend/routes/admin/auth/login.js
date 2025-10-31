// routes/admin/auth/login.js
const { adminLogs } = require("../../../services/logger/contextLogger");
const { PrismaClient } = require("../../../generated/prisma/client");
const { addSchema } = require("../../../schemas/admin/login/add.schema");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");
const jwtSecret = process.env.JWT_SECRET || "SecretKey";
const jwtExpiration = process.env.JWT_EXPIRATION || "1h";
const bcrypt = require("bcrypt");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function adminLoginRoutes(fastify, options) {
  // Login POST handler
  fastify.post("/", async (request, reply) => {
    try {
      const validationResult = addSchema.safeParse(request.body);

      if (!validationResult.success) {
        return reply.status(400).send({
          success: false,
          message: "Invalid data for auth.",
          error:
            process.env.NODE_ENV === "development"
              ? validationResult.error.issues // Show full validation error in development
              : "Invalid credentials", // Generic message in production
        });
      }

      const { email, password } = validationResult.data;

      const existingAdmin = await prisma.admin.findFirst({
        where: {
          email: email,
        },
        include: {
          role: true,
        },
      });

      if (!existingAdmin) {
        return reply.status(404).send({
          success: false,
          message: "Invalid email address for authentication",
        });
      }

      const isPasswordValid = await bcrypt.compare(
        password,
        existingAdmin.password
      );

      if (!isPasswordValid) {
        return reply.status(403).send({
          success: false,
          message: "Invalid password",
        });
      }

      const token = jwt.sign(
        { id: existingAdmin.id, role: existingAdmin.role?.name },
        jwtSecret,
        {
          expiresIn: jwtExpiration,
        }
      );

      adminLogs.info("Admin login attempt", {
        adminId: existingAdmin.id,
        email: existingAdmin.email,
      });

      reply.status(200).send({
        success: true,
        message: "Login successfully",
        token: token,
        name: existingAdmin.name,
        role: existingAdmin.role?.id || null,
      });
      
    } catch (error) {
      adminLogs.error(`Admin login failed`, { error: error });

      return reply.status(500).send({
        success: false,
        message: "Server error during login. Please try again later.",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });
}

module.exports = adminLoginRoutes;