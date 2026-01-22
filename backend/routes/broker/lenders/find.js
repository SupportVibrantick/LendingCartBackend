/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function findBrokerLendersRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Lenders"],
        summary: "Find lenders",
        description:
          "Search lenders to invite (excludes already assigned lenders)",
        querystring: {
          type: "object",
          properties: {
            q: { type: "string", description: "Search by lender name" },
            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, maximum: 50, default: 10 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // ---------------------------
        // Auth safety (CORRECT)
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
        // Pagination & search
        // ---------------------------
        const q = req.query.q || "";
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // ---------------------------
        // Fetch already connected lenders
        // ---------------------------
        const connected = await prisma.brokerLenderAccess.findMany({
          where: {
            brokerOrgId,
            isActive: true,
          },
          select: {
            lenderOrgId: true,
          },
        });

        const connectedLenderIds = connected.map(
          (c) => c.lenderOrgId
        );

        // ---------------------------
        // Search lenders (exclude connected)
        // ---------------------------
        const where = {
          type: "LENDER",
          status: "ACTIVE",
          isDeleted: { not: true },
          ...(connectedLenderIds.length && {
            id: { notIn: connectedLenderIds },
          }),
          ...(q && {
            name: {
              contains: q,
              mode: "insensitive",
            },
          }),
        };

        const [lenders, total] = await Promise.all([
          prisma.organization.findMany({
            where,
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.organization.count({ where }),
        ]);

        // ---------------------------
        // Response
        // ---------------------------
        return reply.send({
          success: true,
          meta: {
            page,
            limit,
            total,
          },
          data: lenders.map((l) => ({
            id: l.id,
            name: l.name,
            email: l.email
              ? l.email.replace(/(.{2}).+(@.+)/, "$1***$2")
              : null,
            phone: l.phone,
            status: "NOT_CONNECTED",
          })),
        });
      } catch (error) {
        req.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Server error while searching lenders",
        });
      }
    }
  );
}

module.exports = findBrokerLendersRoutes;
