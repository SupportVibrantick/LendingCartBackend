/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listInvitedLendersRoutes(fastify) {
  fastify.get(
    "/list",
    {
      schema: {
        tags: ["Broker -> Lenders"],
        summary: "List invited lenders",
        description: "Shows lenders invited by broker with invite status",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // ---------------------------
        // Auth safety
        // ---------------------------
        if (!req.user || !req.user.organizationId) {
          return reply.status(403).send({
            success: false,
            message: "Unauthorized",
          });
        }

        // Validate broker organization
        const brokerOrg = await prisma.organization.findFirst({
          where: {
            id: req.user.organizationId,
            type: "BROKER",
            isDeleted: { not: true },
          },
          select: { id: true },
        });

        if (!brokerOrg) {
          return reply.status(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = brokerOrg.id;

        // ---------------------------
        // Fetch invites sent by broker
        // ---------------------------
        const invites = await prisma.brokerLenderInvite.findMany({
          where: {
            brokerOrgId,
            initiatedBy: "BROKER",
          },
          include: {
            lender: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
                createdAt: true,

                // ⭐ get lender admin profile image
                users: {
                  select: {
                    profileImage: true,
                  },
                  take: 1,
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        // ---------------------------
        // Stats
        // ---------------------------
        const stats = {
          total: invites.length,
          pending: invites.filter(i => i.status === "PENDING").length,
          accepted: invites.filter(i => i.status === "ACCEPTED").length,
          rejected: invites.filter(i => i.status === "REJECTED").length,
        };

        // ---------------------------
        // Response
        // ---------------------------
        return reply.send({
          success: true,
          stats,
          data: invites.map(i => ({
            inviteId: i.id,
            lenderId: i.lender.id,
            name: i.lender.name,
            email: i.lender.email,
            phone: i.lender.phone,

            // ⭐ profile image
            profileImage: i.lender.users[0]?.profileImage || null,

            lenderStatus: i.lender.status,
            inviteStatus: i.status,
            invitedAt: i.createdAt,
          })),
        });
      } catch (error) {
        req.log.error(error);
        return reply.status(500).send({
          success: false,
          message: error.message || "Server error while fetching invited lenders",
        });
      }
    }
  );
}

module.exports = listInvitedLendersRoutes;
