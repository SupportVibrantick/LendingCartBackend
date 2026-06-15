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
            profile: user.brokerProfile
              ? {
                  company: user.brokerProfile.company,
                  tollFree: user.brokerProfile.tollFree,
                  tollFreeExt: user.brokerProfile.tollFreeExt,
                  serviceProvider: user.brokerProfile.serviceProvider,
                  address: user.brokerProfile.address,
                  suite: user.brokerProfile.suite,
                  city: user.brokerProfile.city,
                  state: user.brokerProfile.state,
                  zipCode: user.brokerProfile.zipCode,
                  agentType: user.brokerProfile.agentType,
                  licenseNumber: user.brokerProfile.licenseNumber,
                  preferredComm: user.brokerProfile.preferredComm,
                  website: user.brokerProfile.website,
                  avatarUrl: user.brokerProfile.avatarUrl,
                  createdAt: user.brokerProfile.createdAt,
                  updatedAt: user.brokerProfile.updatedAt,
                }
              : null,
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
