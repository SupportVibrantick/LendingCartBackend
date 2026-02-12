/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listSubmittedApplications(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender -> Loan Pipeline"],
        summary: "List applications sent to lender",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // ----------------------------------
        // 1️⃣ AUTH CHECK
        // ----------------------------------
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;

        // ----------------------------------
        // 2️⃣ FETCH APPLICATIONS
        // ----------------------------------
        const applications = await prisma.applicationLender.findMany({
          where: {
            lenderOrgId,
          },
          orderBy: {
            sentAt: "desc",
          },
          include: {
            loanApplication: {
              select: {
                id: true,
                applicationNumber: true,
                loanProductCode: true,
                amountRequested: true,
                termMonthsRequested: true,
                status: true,
                createdAt: true,
                client: {
                  select: {
                    id: true,
                    legalName: true,
                    entityType: true,
                  },
                },
                brokerOrg: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        // ----------------------------------
        // 3️⃣ FORMAT RESPONSE
        // ----------------------------------
        const formatted = applications.map((item) => ({
          applicationLenderId: item.id,
          lenderStatus: item.status,
          sentAt: item.sentAt,

          applicationId: item.loanApplication.id,
          applicationNumber:
            item.loanApplication.applicationNumber,
          loanProductCode:
            item.loanApplication.loanProductCode,
          amountRequested:
            item.loanApplication.amountRequested,
          termMonthsRequested:
            item.loanApplication.termMonthsRequested,
          applicationStatus:
            item.loanApplication.status,
          createdAt: item.loanApplication.createdAt,

          client: item.loanApplication.client,
          broker: item.loanApplication.brokerOrg,
        }));

        return reply.send({
          success: true,
          total: formatted.length,
          data: formatted,
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.status(500).send({
          success: false,
          message: "Server error while fetching applications",
        });
      }
    }
  );
}

module.exports = listSubmittedApplications;