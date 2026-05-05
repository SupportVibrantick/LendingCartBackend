/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getSubBrokerByIdRoutes(fastify) {
  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Broker -> Sub Broker"],
        summary: "Get Sub Broker by ID",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", minLength: 1 },
          },
        },
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
           PARAM VALIDATION
        =============================== */
        let { id } = req.params;

        if (!id || typeof id !== "string") {
          return reply.code(400).send({
            success: false,
            message: "Invalid id",
          });
        }

        id = id.replace(/"/g, "").trim();

        /* ===============================
           FETCH SUB BROKER
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
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
            createdAt: true,
            createdById: true,
          },
        });

        /* ===============================
           NOT FOUND
        =============================== */
        if (!user) {
          return reply.code(404).send({
            success: false,
            message: "Sub broker not found",
          });
        }

        /* ===============================
           SUCCESS RESPONSE
        =============================== */
        return reply.send({
          success: true,
          data: user,
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            params: req.params,
            user: req.user,
          },
          "❌ Get sub broker by id failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
};