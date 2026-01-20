/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getWebsitePageByType(fastify) {
  fastify.get(
    "/:type",
    {
      schema: {
        tags: ["Broker -> Website Builder"],
        summary: "Get website page by type",
        description: "Fetch website builder page content by page type",
        params: {
          type: "object",
          required: ["type"],
          properties: {
            type: {
              type: "string",
              enum: [
                "BRANDING",
                "HOME",
                "ABOUT",
                "PRODUCTS",
                "WHY_US",
                "HOW_IT_WORKS",
                "CONTACT",
                "FOOTER",
              ],
            },
          },
        },
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

      const { type } = req.params;
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

      // Fetch page
      let page = await prisma.brokerWebsitePage.findFirst({
        where: {
          websiteId: website.id,
          type,
        },
        select: {
          id: true,
          type: true,
          isEnabled: true,
          content: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Auto-create page with empty content (UX-first)
      if (!page) {
        page = await prisma.brokerWebsitePage.create({
          data: {
            websiteId: website.id,
            type,
            isEnabled: true,
            content: {},
          },
          select: {
            id: true,
            type: true,
            isEnabled: true,
            content: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      }

      return reply.send({
        success: true,
        data: page,
      });
    }
  );
}

module.exports = getWebsitePageByType;
