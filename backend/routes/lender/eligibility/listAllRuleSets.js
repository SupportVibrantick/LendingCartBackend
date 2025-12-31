module.exports = async function listAllRuleSetsRoutes(fastify) {
  fastify.get(
    "/all",
    {
      schema: {
        tags: ["Lender → Eligibility"],
        summary: "List all eligibility rule sets for logged-in lender",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const ruleSets = await prisma.eligibilityRuleSet.findMany({
          where: {
            lenderProduct: {
              lenderOrgId: req.user.organizationId,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            lenderProduct: {
              select: {
                id: true,
                loanProductCode: true,
              },
            },
          },
        });

        return reply.send({
          success: true,
          data: ruleSets,
        });
      } catch (err) {
        console.error("LIST ALL RULE SETS ERROR:", err);
        return reply.status(500).send({
          success: false,
          message: err.message,
        });
      }
    }
  );
};
