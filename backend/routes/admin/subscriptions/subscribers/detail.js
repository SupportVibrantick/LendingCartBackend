const { ACTIVE_SUB_STATUSES } = require("../../../../services/subscription/subscriptionBilling");

async function subscriberDetailRoutes(fastify) {
  fastify.get(
    "/:orgId",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Get subscriber detail",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { orgId } = req.params;

      try {
        const org = await prisma.organization.findFirst({
          where: { id: orgId, type: "BROKER" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            createdAt: true,
          },
        });

        if (!org) {
          return reply.status(404).send({
            success: false,
            message: "Broker organization not found",
          });
        }

        const subscription = await prisma.organizationSubscription.findFirst({
          where: {
            organizationId: orgId,
            status: { in: ACTIVE_SUB_STATUSES },
          },
          orderBy: { createdAt: "desc" },
          include: {
            package: true,
            usageRecords: {
              orderBy: { metric: "asc" },
            },
            invoices: {
              orderBy: { createdAt: "desc" },
              take: 20,
            },
          },
        });

        const history = await prisma.organizationSubscription.findMany({
          where: { organizationId: orgId },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            package: {
              select: { id: true, name: true, code: true },
            },
          },
        });

        return reply.send({
          success: true,
          data: {
            organization: org,
            subscription,
            history,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch subscriber detail",
        });
      }
    },
  );
}

module.exports = subscriberDetailRoutes;
