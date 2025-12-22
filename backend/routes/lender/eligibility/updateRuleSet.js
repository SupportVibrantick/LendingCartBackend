const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const {
  updateRuleSetSchema,
} = require("../../../schemas/lender/eligibility/updateRuleSet.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function updateRuleSetRoutes(fastify) {
  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["Lender → Eligibility"],
        summary: "Update eligibility rule set",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
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

        // ✅ Validate body
        const parsed = updateRuleSetSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        // ✅ Ownership check
        const existing = await prisma.eligibilityRuleSet.findFirst({
          where: {
            id: req.params.id,
            lenderProduct: {
              lenderOrgId: req.user.organizationId,
            },
          },
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            message: "Rule set not found",
          });
        }

        // ✅ Safe partial update
        const updateData = {};

        if (parsed.data.name !== undefined)
          updateData.name = parsed.data.name;

        if (parsed.data.description !== undefined)
          updateData.description = parsed.data.description;

        if (parsed.data.effectiveFrom !== undefined)
          updateData.effectiveFrom = parsed.data.effectiveFrom;

        if (parsed.data.effectiveTo !== undefined)
          updateData.effectiveTo = parsed.data.effectiveTo;

        if (parsed.data.isActive !== undefined)
          updateData.isActive = parsed.data.isActive;

        const updated = await prisma.eligibilityRuleSet.update({
          where: { id: req.params.id },
          data: updateData,
        });

        return reply.send({
          success: true,
          message: "Eligibility rule set updated",
          data: updated,
        });
      } catch (err) {
        console.error("UPDATE RULE SET ERROR:", err);
        return reply.status(500).send({
          success: false,
          message: "Server error while updating rule set",
        });
      }
    }
  );
};
