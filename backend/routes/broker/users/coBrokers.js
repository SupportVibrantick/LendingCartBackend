/**
 * Form lookup options for loan officer create/edit.
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function loanOfficerCoBrokersRoute(fastify) {
  fastify.get(
    "/co-brokers",
    {
      schema: {
        tags: ["Broker -> Users"],
        summary: "List co-brokers for loan officer assignment",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can view co-brokers",
          });
        }

        const brokerOrgId = req.user.organizationId;

        const subBrokers = await prisma.userAccount.findMany({
          where: {
            organizationId: brokerOrgId,
            isDeleted: false,
            status: "ACTIVE",
            roles: {
              some: {
                role: { name: "SUB_BROKER" },
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
          data: subBrokers,
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            user: req.user,
          },
          "List loan officer co-brokers failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Failed to load co-brokers",
        });
      }
    },
  );
};
