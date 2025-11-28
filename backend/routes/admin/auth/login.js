// backend/routes/admin/auth/login.js
const { loginSchema } = require("../../../schemas/admin/login/login.schema.js");
const { getUserRolesFromFGA } = require("../../../services/fgaService.js");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
// const prisma = require("../config/prisma.js");
const { comparePassword } = require("../../../utils/password.js");

module.exports = async function adminLoginRoute(fastify, opts) {
  fastify.post("/login", async (request, reply) => {
    try {
      const validationResult = loginSchema.safeParse(request.body);

      if (!validationResult.success) {
        adminLogs.error(`Invalid data for creating role`, {
          error: validationResult.error,
        });

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

      const user = await prisma.userAccount.findUnique({
        where: { email },
        include: {
          roles: { include: { role: true } },
          organization: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          message: "Invalid email address for authentication",
        });
      }

      const match = await comparePassword(password, user.passwordHash);

      if (!match) {
        return reply.status(404).send({
          success: false,
          message: "Invalid password for authentication",
        });
      }

      let fgaRoles = [];
      try {
        fgaRoles = await getUserRolesFromFGA(user.id);
      } catch (e) {
        fastify.log.warn(
          "FGA roles fetch failed:",
          e && e.message ? e.message : e
        );
      }

      const token = jwt.sign(
        {
          userId: user.id,
          orgId: user.organizationId,
          roles: user.roles?.map((r) => r.role.name) ?? [],
        },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );

      return reply.send({
        ok: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          orgId: user.organizationId,
          fgaRoles,
          dbRoles: user.roles?.map((r) => r.role.name) ?? [],
        },
      });
    } catch (err) {
      // Zod validation errors come with .issues
      if (err && err.issues) {
        return reply.code(400).send({ ok: false, errors: err.issues });
      }
      fastify.log.error(err);
      return reply.code(500).send({ ok: false, message: "Server error" });
    }
  });
};
