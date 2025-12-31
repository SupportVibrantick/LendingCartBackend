// backend/routes/lender/eligibility/listRules.js

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listRulesRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender → Eligibility"],
        summary: "List rules in a rule set",
        querystring: {
          type: "object",
          required: ["ruleSetId"],
          properties: {
            ruleSetId: { type: "string", format: "uuid" },
          },
        },
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

        const { ruleSetId } = req.query;

        // Ownership check via rule set → lender product
        const ruleSet = await prisma.eligibilityRuleSet.findFirst({
          where: {
            id: ruleSetId,
            lenderProduct: {
              lenderOrgId: req.user.organizationId,
            },
          },
        });

        if (!ruleSet) {
          return reply.status(404).send({
            success: false,
            message: "Rule set not found",
          });
        }

        const rules = await prisma.eligibilityRule.findMany({
          where: { ruleSetId },
          orderBy: { sortOrder: "asc" },
        });

        return reply.send({
          success: true,
          data: rules,
        });
      } catch (err) {
        console.error("LIST RULES ERROR:", err);
        return reply.status(500).send({
          success: false,
          message: "Server error while listing rules",
        });
      }
    }
  );
};
