/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function publishWebsite(fastify) {
  fastify.post(
    "/publish",
    {
      schema: {
        tags: ["Broker -> Website Builder"],
        summary: "Publish broker website",
        description: "Publish the broker website and make it live",
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
      const userId = req.user.id;
      const prisma = fastify.prisma;

      // Ensure website exists
      const website = await prisma.brokerWebsite.findFirst({
        where: { brokerOrgId },
        select: { id: true, status: true },
      });

      if (!website) {
        return reply.code(404).send({
          success: false,
          message: "Website not initialized",
        });
      }

      // Publish website
      await prisma.brokerWebsite.update({
        where: { id: website.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedBy: userId,
        },
      });

      return reply.send({
        success: true,
        message: "Website published successfully",
      });
    }
  );
}

module.exports = publishWebsite;
