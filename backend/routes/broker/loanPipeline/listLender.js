/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function listLenders(fastify) {

  fastify.get("/:applicationId/lenders", async (req, reply) => {

    const prisma = fastify.prisma;

    try {

      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only"
        });
      }

      const brokerOrgId = req.user.organizationId;
      const { applicationId } = req.params;

      const lenders = await prisma.applicationLender.findMany({
        where: {
          loanApplicationId: applicationId,
          loanApplication: {
            brokerOrgId
          }
        },
        include: {
          lender: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      return reply.send({
        success: true,
        data: lenders
      });

    } catch (error) {

      fastify.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Failed to fetch lenders"
      });

    }

  });

}

module.exports = listLenders;