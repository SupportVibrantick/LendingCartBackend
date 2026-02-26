/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listAllApplications(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Loan Pipeline"],
        summary: "View all submitted applications",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const applications = await prisma.loanApplication.findMany({
          where: {
            status: {
              not: "DRAFT",
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
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
            submissions: {
              include: {
                fields: true,
              },
            },
            applicationLenders: {
              include: {
                lender: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                lenderProduct: {
                  select: {
                    loanProductCode: true,
                  },
                },
              },
            },
          },
        });

        const formatted = applications.map((app) => {
          let amountRequested = null;

          if (app.submissions?.length) {
            const fields = app.submissions[0].fields || [];

            const getField = (key) =>
              fields.find((f) => f.fieldKey === key)?.value;

            amountRequested = Number(getField("amountRequested")) ||
              null;
          }

          return {
            applicationId: app.id,
            applicationNumber: app.applicationNumber,
            loanProductCode: app.loanProductCode,
            amountRequested,
            status: app.status,
            createdAt: app.createdAt,

            client: app.client,
            broker: app.brokerOrg,

            lenders: app.applicationLenders.map((al) => ({
              lenderOrgId: al.lenderOrgId,
              lenderName: al.lender?.name,
              lenderProduct: al.lenderProduct?.loanProductCode,
              lenderStatus: al.status,
              sentAt: al.sentAt,
            })),
          };
        });

        return reply.send({
          success: true,
          total: formatted.length,
          data: formatted,
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.status(500).send({
          success: false,
          message: "Server error",
        });
      }
    }
  );
}

module.exports = listAllApplications;