const { adminLogs } = require("../../../services/logger/contextLogger");

async function listCampaignRoutes(fastify, opts) {
  fastify.get("/", async (request, reply) => {
    const prisma = fastify.prisma;

    try {
      // ✅ query params (scalable)
      const {
        page = 1,
        limit = 10,
        status,
        search,
      } = request.query;

      const skip = (page - 1) * limit;

      // ✅ filters
      const where = {
        ...(status && { status }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { subject: { contains: search, mode: "insensitive" } },
          ],
        }),
      };

      // ✅ fetch campaigns + total count (parallel)
      const [campaigns, total] = await Promise.all([
        prisma.campaign.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: Number(skip),
          take: Number(limit),

          include: {
            recipients: {
              select: {
                status: true,
              },
            },
          },
        }),

        prisma.campaign.count({ where }),
      ]);

      // ✅ add stats per campaign
      const formatted = campaigns.map((c) => {
        const totalRecipients = c.recipients.length;
        const sent = c.recipients.filter(r => r.status === "SENT").length;
        const failed = c.recipients.filter(r => r.status === "FAILED").length;

        return {
          id: c.id,
          name: c.name,
          subject: c.subject,
          status: c.status,
          createdAt: c.createdAt,
          sentAt: c.sentAt,

          // 🔥 important for frontend
          total: totalRecipients,
          sent,
          failed,

          isRecurring: c.isRecurring,
          intervalValue: c.intervalValue,
          intervalUnit: c.intervalUnit,
        };
      });

      return reply.send({
        success: true,
        data: formatted,

        // ✅ pagination info
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / limit),
        },
      });

    } catch (error) {
      adminLogs.error("Failed to list campaigns", { error });

      return reply.status(500).send({
        success: false,
        message: "Server error while fetching campaigns",
      });
    }
  });
}

module.exports = listCampaignRoutes;