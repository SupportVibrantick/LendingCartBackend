// routes/admin/campaign/list.js

const { adminLogs } = require("../../../services/logger/contextLogger");

async function listCampaignRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Campaign"],
        summary: "List campaigns",
        description: "Get all campaigns ordered by latest first",
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const campaigns = await prisma.campaign.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            subject: true,
            status: true,
            createdAt: true,
            sentAt: true,
          },
        });

        return reply.status(200).send({
          success: true,
          message: "Campaigns retrieved successfully",
          data: campaigns,
        });

      } catch (error) {
        adminLogs.error("Failed to list campaigns", { error });

        return reply.status(500).send({
          success: false,
          message: "Server error while fetching campaigns",
          details:
            process.env.NODE_ENV === "development"
              ? error.message
              : undefined,
        });
      }
    }
  );
}

module.exports = listCampaignRoutes;