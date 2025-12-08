// backend/routes/admin/adminUsers/read.js
const fp = require("fastify-plugin");
const { PrismaClient } = require("@prisma/client");
const { getUserRolesFromFGA } = require("../../../services/fgaService");

const prisma = new PrismaClient();

module.exports = fp(async function adminUserReadRoutes(fastify) {

  /**
   * GET /admin/admin-user/read
   * → List only PLATFORM_ADMIN users
   */
  fastify.get("/read", {
    preHandler: [fastify.authenticate, fastify.verifySuperAdmin],
  }, 
  async (req, reply) => {
    try {
      const users = await prisma.userAccount.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          organizationId: true,
          createdAt: true
        }
      });

      const filtered = [];
      for (const user of users) {
        const roles = await getUserRolesFromFGA(user.id);
        if (roles.includes("role:PLATFORM_ADMIN")) {
          filtered.push({
            ...user,
            roles: roles.map(r => r.replace("role:", "")), // clean output
            type: user.organizationId ? "ORG_ADMIN" : "ROOT_PLATFORM_ADMIN"
          });
        }
      }

      return reply.send({ count: filtered.length, users: filtered });

    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ message: "Error retrieving PLATFORM_ADMIN users" });
    }
  });
});
