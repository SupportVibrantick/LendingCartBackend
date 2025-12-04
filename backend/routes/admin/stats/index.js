const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { adminLogs } = require("../../../services/logger/contextLogger.js");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function adminStatsRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Dashboard Stats"],
        summary: "Get system analytics and overview counts",
        description: "Returns stats like total brokers, lenders, clients, loan applications etc.",
      },
    },
    async (request, reply) => {
      try {
        // Perform parallel DB queries for speed
        const [
          totalBrokers,
          totalLenders,
          totalClients,
          totalApplications,
          applicationsDraft,
          applicationsSubmitted,
          applicationsFunded,
          brokerLenderLinks
        ] = await Promise.all([
          prisma.organization.count({ where: { type: "BROKER", isDeleted: false } }),
          prisma.organization.count({ where: { type: "LENDER", isDeleted: false } }),
          prisma.client.count({ where: { isDeleted: false } }),
          prisma.loanApplication.count(),
          prisma.loanApplication.count({ where: { status: "DRAFT" } }),
          prisma.loanApplication.count({ where: { status: "SUBMITTED" } }),
          prisma.loanApplication.count({ where: { status: "FUNDED" } }),
          prisma.brokerLenderAccess.count({ where: { isActive: true } }),
        ]);

        adminLogs.info("Admin dashboard stats fetched");

        return reply.status(200).send({
          success: true,
          message: "Statistics retrieved successfully",
          data: {
            organizations: {
              brokers: totalBrokers,
              lenders: totalLenders,
            },
            clients: totalClients,
            loanApplications: {
              total: totalApplications,
              draft: applicationsDraft,
              submitted: applicationsSubmitted,
              funded: applicationsFunded,
            },
            brokerLenderRelations: brokerLenderLinks,
          },
        });
      } catch (error) {
        adminLogs.error("Fetching admin stats failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while retrieving statistics",
          details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    }
  );
}

module.exports = adminStatsRoutes;
