const {
  parseLoiListQuery,
  queryBrokerLois,
  buildLoiSearchFilter,
  buildLoiPagination,
} = require("../../../utils/broker/brokerLoiList");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function listLoiRoute(fastify) {
  fastify.get(
    "/:applicationId/lois",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Fetch LOIs received from lenders",
        params: {
          type: "object",
          required: ["applicationId"],
          properties: {
            applicationId: { type: "string" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 20 },
            search: { type: "string" },
            sort: {
              type: "string",
              enum: [
                "newest",
                "oldest",
                "amount_desc",
                "amount_asc",
                "rate_asc",
                "rate_desc",
                "lender_az",
              ],
            },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (
          !req.user ||
          req.user.orgType !== "BROKER" ||
          !req.user.organizationId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const { applicationId } = req.params;
        const { page, limit, search, sort, skip } = parseLoiListQuery(
          req.query,
        );

        const application = await prisma.loanApplication.findFirst({
          where: {
            id: applicationId,
            brokerOrgId,
          },
          select: {
            id: true,
            applicationNumber: true,
            status: true,
            amountRequested: true,
            purpose: true,
          },
        });

        if (!application) {
          return reply.code(404).send({
            success: false,
            message: "Application not found",
          });
        }

        const baseWhere = {
          loanApplicationId: applicationId,
          loiUrl: { not: null },
          loiSentToBrokerAt: { not: null },
        };
        const where = {
          ...baseWhere,
          ...buildLoiSearchFilter(search),
        };

        const [totalFiltered, totalLoiReceived, lois] = await Promise.all([
          prisma.applicationLender.count({ where }),
          search
            ? prisma.applicationLender.count({ where: baseWhere })
            : Promise.resolve(null),
          queryBrokerLois(prisma, { where, sort, skip, limit }),
        ]);

        const pagination = buildLoiPagination(page, limit, totalFiltered);

        return reply.send({
          success: true,
          data: {
            applicationId,
            applicationNumber: application.applicationNumber,
            applicationStatus: application.status,
            amountRequested:
              application.amountRequested != null
                ? Number(application.amountRequested)
                : null,
            purpose: application.purpose ?? null,
            totalLoiReceived:
              totalLoiReceived != null ? totalLoiReceived : totalFiltered,
            lois,
            pagination,
          },
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Failed to fetch LOI data",
        });
      }
    },
  );
}

module.exports = listLoiRoute;
