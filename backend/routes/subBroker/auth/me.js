const {
  resolveCoBrokerBranding,
} = require("../../../utils/broker/resolveCoBrokerBranding");
const {
  formatCoBrokerAuthResponse,
  subBrokerAuthInclude,
} = require("../../../utils/broker/subBrokerProfileHelpers");

async function subBrokerMeRoutes(fastify) {
  fastify.get(
    "/me",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Sub Broker -> Auth"],
        summary: "Get logged-in sub broker user",
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const { userId, organizationId } = request.user;

        const user = await prisma.userAccount.findUnique({
          where: { id: userId },
          include: subBrokerAuthInclude,
        });

        if (!user || user.organizationId !== organizationId) {
          return reply.code(404).send({
            ok: false,
            message: "User not found",
          });
        }

        const [branding, assignedApplications] = await Promise.all([
          resolveCoBrokerBranding(prisma, user.id, user.organizationId),
          prisma.subBrokerApplication.count({
            where: { subBrokerId: userId },
          }),
        ]);

        return reply.send({
          ok: true,
          data: formatCoBrokerAuthResponse(
            user,
            branding,
            assignedApplications,
          ),
        });
      } catch (err) {
        request.log.error(err);

        return reply.code(500).send({
          ok: false,
          message: "Failed to fetch sub broker profile",
        });
      }
    },
  );
}

module.exports = subBrokerMeRoutes;
