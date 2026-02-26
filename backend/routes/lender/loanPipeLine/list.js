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
                  take: 1, // only first submission
                  include: {
                    fields: true,
                  },
                },
              },
            },
          },
        });

        // ----------------------------------
        // 3️⃣ FORMAT RESPONSE
        // ----------------------------------
        const formatted = applications.map((item) => {
          const app = item.loanApplication;

          let amountRequested = null;
          let termMonthsRequested = null;

          if (app.submissions?.length) {
            const fields = app.submissions[0].fields || [];

            const getField = (key) =>
              fields.find((f) => f.fieldKey === key)?.value;

            amountRequested = Number(getField("amountRequested")) || null;

            const minTerm = Number(getField("minTermMonths"));
            const maxTerm = Number(getField("maxTermMonths"));
            const termYears = Number(getField("requested_term_years"));

            if (maxTerm) {
              termMonthsRequested = maxTerm;
            } else if (termYears) {
              termMonthsRequested = termYears * 12;
            } else if (minTerm) {
              termMonthsRequested = minTerm;
            }
          }

          return {
            applicationLenderId: item.id,
            lenderStatus: item.status,
            sentAt: item.sentAt,

            applicationId: app.id,
            applicationNumber: app.applicationNumber,
            loanProductCode: app.loanProductCode,
            amountRequested,
            termMonthsRequested,
            applicationStatus: app.status,
            createdAt: app.createdAt,

            client: app.client,
            broker: app.brokerOrg,
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
          message: "Server error while fetching applications",
        });
      }
    },
  );
}

module.exports = listSubmittedApplications;