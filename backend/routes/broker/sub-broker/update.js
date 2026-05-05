/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function updateSubBrokerRoutes(fastify) {
  fastify.patch(
    "/:id/update",
    {
      schema: {
        tags: ["Broker -> Sub Broker"],
        summary: "Update Sub Broker",

        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", minLength: 1 },
          },
        },

        body: {
          type: "object",
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            phone: { type: "string" },
            password: { type: "string", minLength: 8 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const bcrypt = require("bcrypt");

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
        const { firstName, lastName, phone, password } = req.body;

        /* ===============================
           FIND SUB BROKER
        =============================== */
        const existingUser = await prisma.userAccount.findFirst({
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

        if (!existingUser) {
          return reply.code(404).send({
            success: false,
            message: "Sub broker not found",
          });
        }

        /* ===============================
           PREPARE UPDATE DATA
        =============================== */
        const updateData = {};

        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (phone !== undefined) updateData.phone = phone;

        // Password update (optional)
        if (password) {
          updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        /* ===============================
           UPDATE USER
        =============================== */
        const updatedUser = await prisma.userAccount.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
            updatedAt: true,
          },
        });

        /* ===============================
           SUCCESS RESPONSE
        =============================== */
        return reply.send({
          success: true,
          message: "Sub broker updated successfully",
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
          "❌ Update sub broker failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
};