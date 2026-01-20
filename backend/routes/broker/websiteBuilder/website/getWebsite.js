/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getBrokerWebsite(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Website Builder"],
        summary: "Get broker website",
        description: "Fetch website builder root config for logged-in broker",
      },
    },
    async (req, reply) => {
      // Authorization check
      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const brokerOrgId = req.user.organizationId;
      const prisma = fastify.prisma;

      // Fetch website
      let website = await prisma.brokerWebsite.findFirst({
        where: { brokerOrgId },
        select: {
          id: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Auto-create website (UX-first)
      if (!website) {
        website = await prisma.brokerWebsite.create({
          data: {
            brokerOrgId,
            status: "DRAFT",
          },
          select: {
            id: true,
            status: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      }

      return reply.send({
        success: true,
        data: website,
      });
    }
  );
}

module.exports = getBrokerWebsite;
