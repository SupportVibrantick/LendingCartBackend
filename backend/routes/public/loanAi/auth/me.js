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
      let subscribedBillingCycle = null;
      let subscriptionStatus = null;
      let subscriptionMessage = null;

      if (user.brokerOrganizationId) {
        const sub = await fastify.prisma.organizationSubscription.findFirst({
          where: { organizationId: user.brokerOrganizationId },
          orderBy: { createdAt: "desc" },
          include: {
            package: { select: { id: true, code: true, name: true } },
          },
        });

        if (sub) {
          subscriptionStatus = sub.status;
          if (["TRIAL", "ACTIVE", "PAST_DUE"].includes(sub.status)) {
            hasBrokerSubscription = true;
            subscribedPackageId = sub.packageId;
            subscribedPackageCode = sub.package?.code ?? null;
            subscribedBillingCycle = sub.billingCycle;
          } else if (sub.status === "EXPIRED") {
            subscriptionMessage =
              "Your previous subscription has expired. Choose a plan to renew.";
          } else if (sub.status === "CANCELLED") {
            subscriptionMessage =
              "Your subscription was cancelled. Choose a plan to subscribe again.";
          }
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
          subscribedBillingCycle,
          subscriptionStatus,
          subscriptionMessage,
        },
      });
    },
  );
}

module.exports = loanAiMeRoutes;
