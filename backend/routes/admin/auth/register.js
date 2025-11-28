// backend/routes/admin/auth/register.js
const { z } = require("zod");
const bcrypt = require("bcryptjs");
const prisma = require("../../../config/prisma.js");
const { assignRoleToUser } = require("../../../services/fgaService.js");
const jwt = require("jsonwebtoken");

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  role: z.string().optional(),
});

module.exports = async function adminRegisterRoute(fastify, opts) {
  fastify.post("/register", async (req, reply) => {
    try {
      const data = bodySchema.parse(req.body);

      const existing = await prisma.userAccount.findUnique({ where: { email: data.email } });
      if (existing) return reply.code(409).send({ ok: false, message: "Email already used" });

      const hashed = await bcrypt.hash(data.password, 12);

      const user = await prisma.userAccount.create({
        data: {
          email: data.email,
          passwordHash: hashed,
          firstName: data.firstName ?? null,
          lastName: data.lastName ?? null,
          organizationId: data.organizationId ?? null,
        },
        select: { id: true, email: true, organizationId: true, firstName: true, lastName: true }
      });

      const roleToAssign = data.role ?? "CLIENT_USER";
      try {
        await assignRoleToUser(user.id, roleToAssign);
      } catch (e) {
        fastify.log.warn("OpenFGA assignRole failed:", e && e.message ? e.message : e);
      }

      const token = jwt.sign(
        { userId: user.id, orgId: user.organizationId ?? null },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );

      return reply.code(201).send({ ok: true, token, user });
    } catch (err) {
      if (err && err.issues) return reply.code(400).send({ ok: false, errors: err.issues });
      fastify.log.error(err);
      return reply.code(500).send({ ok: false, message: "Server error" });
    }
  });
};
