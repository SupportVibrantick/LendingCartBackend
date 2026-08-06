/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function subBrokerStatusRoutes(fastify) {
  const {
    requireLoOfficerPermission,
  } = require("../../../services/broker/loanOfficerAccess");

  fastify.patch(
    "/:id/status",
    {
      schema: {
        tags: ["Broker -> Sub Broker"],
        summary: "Update Sub Broker Status",

        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", minLength: 1 },
          },
        },

        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["ACTIVE", "DISABLED"],
            },
          },
        },
      },
      preHandler: async (req, reply) => {
        await requireLoOfficerPermission(req, reply, fastify, "DISABLE_CO_BROKERS");
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ===============================
           AUTH CHECK (MATCH YOUR STYLE)
        =============================== */
        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Authentication required",
          });
        }

        if (
          !req.user.organizationId ||
          req.user.orgType !== "BROKER"
        ) {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const roles = req.user.roles || [];

        const allowedRoles = ["BROKER_ADMIN", "BROKER_OFFICER"];

        const hasAccess = roles.some((role) =>
          allowedRoles.includes(role)
        );

        if (!hasAccess) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const brokerOrgId = req.user.organizationId;

        /* ===============================
           PARAMS & BODY
        =============================== */
        const { id } = req.params;
        const { status } = req.body;

        /* ===============================
           FIND USER (ONLY SUB BROKER)
        =============================== */
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

        /* ===============================
           UPDATE STATUS
        =============================== */
        const updatedUser = await prisma.userAccount.update({
          where: { id },
          data: {
            status,
          },
          select: {
            id: true,
            email: true,
            status: true,
            firstName: true,
            lastName: true,
          },
        });

        /* ===============================
           SUCCESS RESPONSE
        =============================== */
        return reply.send({
          success: true,
          message: `Sub broker ${status.toLowerCase()} successfully`,
          data: updatedUser,
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            params: req.params,
            body: req.body,
            user: req.user,
          },
          "❌ Update sub broker status failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
};