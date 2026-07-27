const { ACTIVE_SUB_STATUSES } = require("../../../services/subscription/subscriptionBilling");

function formatLoanAiUser(user) {
  const org = user.brokerOrganization;
  const subscription = org?.organizationSubscriptions?.[0] || null;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    hasBrokerSubscription: Boolean(user.brokerOrganizationId && subscription),
    brokerOrganizationId: user.brokerOrganizationId,
    organization: org
      ? {
          id: org.id,
          name: org.name,
          email: org.email,
          status: org.status,
        }
      : null,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          billingCycle: subscription.billingCycle,
          package: subscription.package
            ? {
                id: subscription.package.id,
                name: subscription.package.name,
                code: subscription.package.code,
              }
            : null,
          purchasedAddOns: subscription.purchasedAddOns ?? null,
        }
      : null,
  };
}

function buildWhere(query) {
  const { search, hasSubscription } = query;
  const and = [];

  const term = typeof search === "string" ? search.trim() : "";
  if (term) {
    and.push({
      OR: [
        { email: { contains: term, mode: "insensitive" } },
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  if (hasSubscription === "true") {
    and.push({
      brokerOrganizationId: { not: null },
      brokerOrganization: {
        organizationSubscriptions: {
          some: { status: { in: ACTIVE_SUB_STATUSES } },
        },
      },
    });
  } else if (hasSubscription === "false") {
    and.push({
      OR: [
        { brokerOrganizationId: null },
        {
          brokerOrganization: {
            organizationSubscriptions: {
              none: { status: { in: ACTIVE_SUB_STATUSES } },
            },
          },
        },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

const orgInclude = {
  select: {
    id: true,
    name: true,
    email: true,
    status: true,
    organizationSubscriptions: {
      where: { status: { in: ACTIVE_SUB_STATUSES } },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: {
        id: true,
        status: true,
        billingCycle: true,
        purchasedAddOns: true,
        package: {
          select: { id: true, name: true, code: true },
        },
      },
    },
  },
};

async function listLoanAiUsersRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Loan AI Users"],
        summary: "List Loan AI marketing site registrations",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const { page = 1, limit = 20 } = req.query;
        const pageNum = Math.max(Number(page) || 1, 1);
        const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
        const skip = (pageNum - 1) * limitNum;
        const where = buildWhere(req.query);

        const [total, users] = await Promise.all([
          prisma.loanAiUser.count({ where }),
          prisma.loanAiUser.findMany({
            where,
            skip,
            take: limitNum,
            orderBy: { createdAt: "desc" },
            include: {
              brokerOrganization: orgInclude,
            },
          }),
        ]);

        return reply.send({
          success: true,
          data: users.map(formatLoanAiUser),
          meta: { total, page: pageNum, limit: limitNum },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch Loan AI users",
        });
      }
    },
  );
}

module.exports = listLoanAiUsersRoutes;
