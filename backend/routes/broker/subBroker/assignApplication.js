const prisma = require("../../../config/prisma");

const { z } = require("zod");

const assignSchema = z.object({
  loanApplicationId: z.string().uuid(),

  subBrokerId: z.string().uuid(),
});

async function assignApplicationRoute(fastify, options) {
  fastify.post(
    "/assign-application",

    {
      preHandler: [fastify.authenticate, fastify.requireRole(["BROKER"])],
    },

    async (request, reply) => {
      try {
        const brokerId = request.user.userId;

        // VALIDATE
        const validated = assignSchema.parse(request.body);

        const { loanApplicationId, subBrokerId } = validated;

        // CHECK APPLICATION
        const application = await prisma.loanApplication.findFirst({
          where: {
            id: loanApplicationId,

            isDeleted: false,
          },
        });

        if (!application) {
          return reply.code(404).send({
            success: false,
            message: "Application not found",
          });
        }

        // CHECK SUB BROKER
        const subBroker = await prisma.userAccount.findFirst({
          where: {
            id: subBrokerId,

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

        if (!subBroker) {
          return reply.code(404).send({
            success: false,
            message: "Sub broker not found",
          });
        }

        // ALREADY ASSIGNED?
        const existing = await prisma.subBrokerApplication.findFirst({
          where: {
            loanApplicationId,
            subBrokerId,
          },
        });

        if (existing) {
          return reply.code(400).send({
            success: false,
            message: "Application already assigned",
          });
        }

        // CREATE ASSIGNMENT
        const assignment = await prisma.subBrokerApplication.create({
          data: {
            loanApplicationId,

            subBrokerId,

            assignedById: brokerId,
          },
        });

        return reply.code(201).send({
          success: true,

          message: "Application assigned successfully",

          data: assignment,
        });
      } catch (err) {
        console.error(err);

        // ZOD
        if (err?.name === "ZodError") {
          return reply.code(400).send({
            success: false,
            message: "Validation failed",
            errors: err.errors,
          });
        }

        return reply.code(500).send({
          success: false,

          message: err.message || "Something went wrong",
        });
      }
    },
  );
}

module.exports = assignApplicationRoute;
