/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function saveWebsitePage(fastify) {
  fastify.put(
    "/:type",
    {
      schema: {
        tags: ["Broker -> Website Builder"],
        summary: "Save website page content",
        description: "Create or update website builder page content by type",

        // ✅ PARAMS MUST BE AN OBJECT SCHEMA
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

        // ✅ BODY MUST BE AN OBJECT SCHEMA
        body: {
          type: "object",
          required: ["content"],
          properties: {
            content: {
              type: "object",
              additionalProperties: true,
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
      const { content } = req.body;
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

      // Upsert page content
      const page = await prisma.brokerWebsitePage.upsert({
        where: {
          websiteId_type: {
            websiteId: website.id,
            type,
          },
        },
        update: {
          content,
        },
        create: {
          websiteId: website.id,
          type,
          isEnabled: true,
          content,
        },
        select: {
          id: true,
          type: true,
          isEnabled: true,
          content: true,
          updatedAt: true,
        },
      });

      return reply.send({
        success: true,
        message: "Page saved successfully",
        data: page,
      });
    }
  );
}

module.exports = saveWebsitePage;
