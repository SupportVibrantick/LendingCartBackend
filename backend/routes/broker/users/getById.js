const {
  mergeBrokerProfileResponse,
} = require("../../../utils/brokerUserProfileHelpers");
const {
  formatAssignedSubBrokers,
} = require("../../../utils/subBrokerProfileHelpers");

module.exports = async function getBrokerUserById(fastify) {
  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Broker -> Users"],
        summary: "Get loan officer details",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { id } = req.params;

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
            message: "Only Broker Admin can view user details",
          });
        }

        const brokerOrgId = req.user.organizationId;

        const user = await prisma.userAccount.findFirst({
          where: {
            id,
            organizationId: brokerOrgId,
            isDeleted: false,
            roles: { some: { role: { name: "BROKER_OFFICER" } } },
          },
          include: {
            roles: {
              include: {
                role: { select: { name: true } },
              },
            },
            brokerProfile: true,
            userPermissions: {
              include: {
                permission: { select: { key: true } },
              },
            },
            _count: {
              select: { brokerLoanApplications: true },
            },
            loanOfficerSubBrokers: {
              include: {
                subBroker: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    profileImage: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        });

        if (!user) {
          return reply.code(404).send({
            success: false,
            message: "Loan officer not found",
          });
        }

        return reply.send({
          success: true,
          data: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            status: user.status,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            roles: user.roles.map((r) => r.role.name),
            permissions: user.userPermissions.map((p) => p.permission.key),
            assignedDeals: user._count.brokerLoanApplications,
            assignedCoBrokers: formatAssignedSubBrokers(user.loanOfficerSubBrokers),
            assignedCoBrokerIds: formatAssignedSubBrokers(
              user.loanOfficerSubBrokers,
            ).map((item) => item.id),
            profile: mergeBrokerProfileResponse(user.brokerProfile),
          },
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            brokerOrgId: req.user?.organizationId,
            userId: id,
          },
          "Failed to fetch broker user details",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error while fetching user details",
        });
      }
    },
  );
};
