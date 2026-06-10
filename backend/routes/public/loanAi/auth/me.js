async function loanAiMeRoutes(fastify) {
  fastify.get(
    "/",
    {
      preHandler: [fastify.verifyLoanAi],
      schema: {
        tags: ["Public -> Loan AI Auth"],
        summary: "Get current Loan AI user",
      },
    },
    async (req, reply) => {
      const user = req.loanAiUser;

      let hasBrokerSubscription = false;
      let subscribedPackageId = null;
      let subscribedPackageCode = null;

      if (user.brokerOrganizationId) {
        const sub = await fastify.prisma.organizationSubscription.findFirst({
          where: {
            organizationId: user.brokerOrganizationId,
            status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] },
          },
          include: {
            package: { select: { id: true, code: true, name: true } },
          },
        });

        if (sub) {
          hasBrokerSubscription = true;
          subscribedPackageId = sub.packageId;
          subscribedPackageCode = sub.package?.code ?? null;
        }
      }

      return reply.send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          hasBrokerSubscription,
          subscribedPackageId,
          subscribedPackageCode,
        },
      });
    },
  );
}

module.exports = loanAiMeRoutes;
