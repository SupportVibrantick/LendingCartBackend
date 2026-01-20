/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getWebsitePages(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Website Builder"],
        summary: "Get website pages",
        description: "Fetch all website builder pages for the logged-in broker",
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

      // Ensure website exists
      const website = await prisma.brokerWebsite.findFirst({
        where: { brokerOrgId },
        select: { id: true },
      });

      if (!website) {
        return reply.code(404).send({
          success: false,
          message: "Website not initialized",
        });
      }

      // Fetch pages
      const pages = await prisma.brokerWebsitePage.findMany({
        where: { websiteId: website.id },
        select: {
          id: true,
          type: true,
          isEnabled: true,
          order: true,
        },
        orderBy: { order: "asc" },
      });

      return reply.send({
        success: true,
        data: pages,
      });
    }
  );
}

module.exports = getWebsitePages;
