/**
 * Form lookup options for co-broker create/edit.
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function subBrokerFormOptionsRoutes(fastify) {
  const {
    requireLoOfficerPermission,
  } = require("../../../services/broker/loanOfficerAccess");

  fastify.get(
    "/loan-officers",
    {
      schema: {
        tags: ["Broker -> Sub Broker"],
        summary: "List loan officers for co-broker assignment",
      },
      preHandler: async (req, reply) => {
        await requireLoOfficerPermission(req, reply, fastify, "VIEW_CO_BROKERS");
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

        const officers = await prisma.userAccount.findMany({
          where: {
            organizationId: brokerOrgId,
            isDeleted: false,
            status: "ACTIVE",
            roles: {
              some: {
                role: { name: "BROKER_OFFICER" },
              },
            },
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        });

        return reply.send({
          success: true,
          data: officers,
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            user: req.user,
          },
          "List co-broker loan officers failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
};
