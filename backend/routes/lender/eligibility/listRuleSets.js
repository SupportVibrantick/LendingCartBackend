// backend/routes/lender/eligibility/listRuleSets.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listRuleSetsRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender → Eligibility"],
        summary: "List eligibility rule sets by lender product",
        querystring: {
          type: "object",
          required: ["lenderProductId"],
          properties: {
            lenderProductId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
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

        const { lenderProductId } = req.query;

        // Ownership check
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

        const ruleSets = await prisma.eligibilityRuleSet.findMany({
          where: { lenderProductId },
          orderBy: { createdAt: "asc" },
        });

        return reply.send({
          success: true,
          data: ruleSets,
        });
      } catch (err) {
        console.error("LIST RULE SETS ERROR:", err);
        return reply.status(500).send({
          success: false,
          message: "Server error while listing rule sets",
        });
      }
    }
  );
};
