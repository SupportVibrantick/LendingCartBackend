// backend/routes/lender/eligibility/createRuleSet.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const {
  createRuleSetSchema,
} = require("../../../schemas/lender/eligibility/createRuleSet.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createRuleSetRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender -> Eligibility"],
        summary: "Create eligibility rule set",
      },
    },
    async (req, reply) => {
      try {
        // 🔐 Auth check
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

        // ✅ Validate input
        const parsed = createRuleSetSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const { lenderProductId, name, description } = parsed.data;

        // ✅ Ownership check
        const product = await prisma.lenderProduct.findFirst({
          where: {
            id: lenderProductId,
            lenderOrgId: req.user.organizationId,
          },
        });

        if (!product) {
          return reply.status(404).send({
            success: false,
            message: "Lender product not found",
          });
        }

        // ✅ Prevent duplicate rule-set names per product
        const exists = await prisma.eligibilityRuleSet.findFirst({
          where: {
            lenderProductId,
            name,
          },
        });

        if (exists) {
          return reply.status(409).send({
            success: false,
            message: "Rule set already exists for this product",
          });
        }

        // ✅ Create rule set
        const ruleSet = await prisma.eligibilityRuleSet.create({
          data: {
            lenderProductId,
            name,
            description: description ?? null,
          },
        });

        return reply.status(201).send({
          success: true,
          message: "Eligibility rule set created",
          data: ruleSet,
        });
      } catch (err) {
        console.error("CREATE RULE SET ERROR:", err);
        return reply.status(500).send({
          success: false,
          message: "Server error while creating rule set",
        });
      }
    }
  );
}

module.exports = createRuleSetRoutes;
