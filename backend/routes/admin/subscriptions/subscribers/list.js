const { ACTIVE_SUB_STATUSES } = require("../../../../services/subscription/subscriptionBilling");

function formatSubscriber(org, subscription) {
  return {
    organizationId: org.id,
    organizationName: org.name,
    organizationEmail: org.email,
    organizationStatus: org.status,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          trialEndsAt: subscription.trialEndsAt,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          package: subscription.package
            ? {
                id: subscription.package.id,
                name: subscription.package.name,
                code: subscription.package.code,
                priceMonthly: subscription.package.priceMonthly,
                priceYearly: subscription.package.priceYearly,
              }
            : null,
        }
      : null,
  };
}

function buildSubscriberWhere(query) {
  const { search, status, packageId, billingCycle, hasSubscription } = query;
  const and = [{ type: "BROKER" }, { isDeleted: { not: true } }];

  const term = typeof search === "string" ? search.trim() : "";
  if (term) {
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
        {
          organizationSubscriptions: {
            some: {
              status: { in: ACTIVE_SUB_STATUSES },
              package: {
                OR: [
                  { name: { contains: term, mode: "insensitive" } },
                  { code: { contains: term, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
    });
  }

  if (hasSubscription === "false") {
    and.push({
      organizationSubscriptions: {
        none: { status: { in: ACTIVE_SUB_STATUSES } },
      },
    });
  } else {
    const needsSubFilter =
      hasSubscription === "true" || Boolean(status || packageId || billingCycle);

    if (needsSubFilter) {
      and.push({
        organizationSubscriptions: {
          some: {
            status: status || { in: ACTIVE_SUB_STATUSES },
            ...(packageId ? { packageId } : {}),
            ...(billingCycle ? { billingCycle } : {}),
          },
        },
      });
    }
  }

  return { AND: and };
}

const subscriptionInclude = {
  where: { status: { in: ACTIVE_SUB_STATUSES } },
  orderBy: { createdAt: "desc" },
  take: 1,
  include: {
    package: {
      select: {
        id: true,
        name: true,
        code: true,
        priceMonthly: true,
        priceYearly: true,
      },
    },
  },
};

async function listSubscribersRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "List broker subscribers",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const { page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(Number(page) || 1, 1);
        const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
        const skip = (pageNum - 1) * limitNum;

        const where = buildSubscriberWhere(req.query);

        const [total, brokers] = await Promise.all([
          prisma.organization.count({ where }),
          prisma.organization.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              organizationSubscriptions: subscriptionInclude,
            },
          }),
        ]);

        const rows = brokers.map((b) =>
          formatSubscriber(b, b.organizationSubscriptions[0] || null),
        );

        return reply.send({
          success: true,
          data: rows,
          meta: { total, page: pageNum, limit: limitNum },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch subscribers",
        });
      }
    },
  );
}

module.exports = listSubscribersRoutes;
