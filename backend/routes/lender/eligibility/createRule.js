
const {
  createRuleSchema,
} = require("../../../schemas/lender/eligibility/create.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function createRuleRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender → Eligibility"],
        summary: "Create eligibility rule",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        //  Auth check
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

        //  Zod validation
        const parsed = createRuleSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const {
          ruleSetId,
          fieldName,
          comparisonOperator,
          value,
          severity,
          message,
          sortOrder,
        } = parsed.data;

        //  Ownership check (RuleSet → LenderProduct → LenderOrg)
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

        //  Create rule
        const rule = await prisma.eligibilityRule.create({
          data: {
            ruleSetId,
            fieldName,
            comparisonOperator,
            value,
            severity,
            message: message ?? null,
            sortOrder: sortOrder ?? null,
          },
        });

        return reply.status(201).send({
          success: true,
          message: "Eligibility rule created",
          data: rule,
        });
      } catch (err) {
        console.error("CREATE RULE ERROR:", err);
        return reply.status(500).send({
          success: false,
          message: "Server error while creating rule",
        });
      }
    }
  );
};
