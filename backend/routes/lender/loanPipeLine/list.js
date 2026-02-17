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
        querystring: {
          type: "object",
          properties: {
            status: { type: "string" }, // optional lenderStatus filter
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ===============================
           1️⃣ AUTH CHECK (STRICT USER-WISE)
        =============================== */
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

        const page = req.query.page || 1;
        const limit = req.query.limit || 20;
        const skip = (page - 1) * limit;

        /* ===============================
           2️⃣ BUILD WHERE FILTER
        =============================== */
        const whereClause = {
          lenderOrgId, // 🔥 strict segregation
        };

        if (req.query.status) {
          whereClause.status = req.query.status;
        }

        /* ===============================
           3️⃣ FETCH DATA
        =============================== */
        const [records, total] = await prisma.$transaction([
          prisma.applicationLender.findMany({
            where: whereClause,
            orderBy: { sentAt: "desc" },
            skip,
            take: limit,
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
                    orderBy: { createdAt: "desc" }, // latest submission
                    take: 1,
                    include: {
                      fields: true,
                    },
                  },
                },
              },
            },
          }),
          prisma.applicationLender.count({
            where: whereClause,
          }),
        ]);

        /* ===============================
           4️⃣ FORMAT CLEAN SEGREGATED JSON
        =============================== */
        const data = records.map((item) => {
          const app = item.loanApplication;
          const latestSubmission = app.submissions[0] || null;
          const fields = latestSubmission?.fields || [];

          const getField = (key) =>
            fields.find((f) => f.fieldKey === key)?.value;

          const amountRequested =
            Number(getField("amountRequested")) || null;

          const termYears = Number(getField("requested_term_years"));
          const minTerm = Number(getField("minTermMonths"));
          const maxTerm = Number(getField("maxTermMonths"));

          let termMonthsRequested = null;

          if (maxTerm) termMonthsRequested = maxTerm;
          else if (termYears) termMonthsRequested = termYears * 12;
          else if (minTerm) termMonthsRequested = minTerm;

          return {
            distribution: {
              applicationLenderId: item.id,
              lenderStatus: item.status,
              sentAt: item.sentAt,
              lastUpdatedAt: item.lastUpdatedAt,
            },

            application: {
              id: app.id,
              applicationNumber: app.applicationNumber,
              status: app.status,
              loanProductCode: app.loanProductCode,
              createdAt: app.createdAt,
              amountRequested,
              termMonthsRequested,
            },

            borrower: {
              clientId: app.client.id,
              legalName: app.client.legalName,
              entityType: app.client.entityType,
            },

            broker: {
              brokerOrgId: app.brokerOrg.id,
              brokerName: app.brokerOrg.name,
            },
          };
        });

        /* ===============================
           5️⃣ RESPONSE
        =============================== */
        return reply.send({
          success: true,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
          data,
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