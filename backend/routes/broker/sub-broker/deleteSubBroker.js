/**
 * @param {import("fastify").FastifyInstance} fastify
 */

function buildFreedDeletedEmail(user) {
  const at = user.email.lastIndexOf("@");
  if (at === -1) {
    return `${user.id.replace(/-/g, "")}.deleted@removed.local`;
  }

  const local = user.email.slice(0, at);
  const domain = user.email.slice(at + 1);
  return `${local}+deleted.${user.id.slice(0, 8)}.${Date.now()}@${domain}`;
}

module.exports = async function deleteSubBrokerRoutes(fastify) {
  const {
    requireLoOfficerPermission,
  } = require("../../../services/broker/loanOfficerAccess");

  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Broker -> Sub Broker"],
        summary: "Soft-delete sub broker",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", minLength: 1 },
          },
        },
      },
      preHandler: async (req, reply) => {
        await requireLoOfficerPermission(req, reply, fastify, "DELETE_CO_BROKERS");
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Authentication required",
          });
        }

        if (!req.user.organizationId || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const roles = req.user.roles || [];
        const allowedRoles = ["BROKER_ADMIN", "BROKER_OFFICER"];
        const hasAccess = roles.some((role) => allowedRoles.includes(role));

        if (!hasAccess) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const brokerOrgId = req.user.organizationId;
        let { id } = req.params;

        if (!id || typeof id !== "string") {
          return reply.code(400).send({
            success: false,
            message: "Invalid id",
          });
        }

        id = id.replace(/"/g, "").trim();

        const user = await prisma.userAccount.findFirst({
          where: {
            id,
            organizationId: brokerOrgId,
            isDeleted: false,
            roles: {
              some: {
                role: {
                  name: "SUB_BROKER",
                },
              },
            },
          },
        });

        if (!user) {
          return reply.code(404).send({
            success: false,
            message: "Sub broker not found",
          });
        }

        await prisma.userAccount.update({
          where: { id },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
            status: "DISABLED",
            email: buildFreedDeletedEmail(user),
          },
        });

        return reply.send({
          success: true,
          message: "Sub broker deleted successfully",
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            params: req.params,
            user: req.user,
          },
          "Delete sub broker failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
};
