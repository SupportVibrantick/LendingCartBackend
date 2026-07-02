const {
  formatAssignedLoanOfficers,
} = require("../../../utils/subBrokerProfileHelpers");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listSubBrokersRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Sub Broker"],
        summary: "List Sub Brokers",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ===============================
           AUTH CHECK (MATCH YOUR STYLE)
        =============================== */
        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Authentication required",
          });
        }

        if (
          !req.user.organizationId ||
          req.user.orgType !== "BROKER"
        ) {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const roles = req.user.roles || [];

        const allowedRoles = ["BROKER_ADMIN", "BROKER_OFFICER"];

        const hasAccess = roles.some((role) =>
          allowedRoles.includes(role)
        );

        if (!hasAccess) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const brokerOrgId = req.user.organizationId;

        /* ===============================
           FETCH SUB BROKERS
        =============================== */
        const users = await prisma.userAccount.findMany({
          where: {
            organizationId: brokerOrgId,
            isDeleted: false,
            roles: {
              some: {
                role: {
                  name: "SUB_BROKER",
                },
              },
            },
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
            createdAt: true,
            createdById: true,
            subBrokerLoanOfficers: {
              include: {
                loanOfficer: {
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
          orderBy: {
            createdAt: "desc",
          },
        });

        /* ===============================
           EMPTY CASE
        =============================== */
        if (!users || users.length === 0) {
          return reply.send({
            success: true,
            data: [],
            message: "No sub brokers found",
          });
        }

        /* ===============================
           FORMAT RESPONSE
        =============================== */
        const data = users.map((u) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone,
          status: u.status,
          createdAt: u.createdAt,
          createdById: u.createdById,
          assignedLoanOfficers: formatAssignedLoanOfficers(u.subBrokerLoanOfficers),
        }));

        /* ===============================
           SUCCESS RESPONSE
        =============================== */
        return reply.send({
          success: true,
          count: data.length,
          data,
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            user: req.user,
          },
          "❌ List sub brokers failed"
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    }
  );
};