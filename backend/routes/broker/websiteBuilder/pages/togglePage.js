/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function toggleWebsitePage(fastify) {
  fastify.patch(
    "/:type/toggle",
    {
      schema: {
        tags: ["Broker -> Website Builder"],
        summary: "Enable or disable website page",
        description: "Toggle visibility of a website builder page by type",

        // ✅ PARAMS MUST BE OBJECT SCHEMA
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

        // ✅ BODY MUST BE OBJECT SCHEMA
        body: {
          type: "object",
          required: ["isEnabled"],
          properties: {
            isEnabled: {
              type: "boolean",
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
      const { isEnabled } = req.body;
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

      // Update page toggle
      const result = await prisma.brokerWebsitePage.updateMany({
        where: {
          websiteId: website.id,
          type,
        },
        data: {
          isEnabled,
        },
      });

      if (result.count === 0) {
        return reply.code(404).send({
          success: false,
          message: "Page not found",
        });
      }

      return reply.send({
        success: true,
        message: `Page ${isEnabled ? "enabled" : "disabled"} successfully`,
      });
    }
  );
}

module.exports = toggleWebsitePage;
