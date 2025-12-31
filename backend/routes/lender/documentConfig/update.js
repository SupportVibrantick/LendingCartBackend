const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const {
  updateLenderDocumentConfigSchema,
} = require("../../../schemas/lender/documentConfig/update.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function updateLenderDocumentConfigRoutes(fastify) {
  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["Lender -> Document Config"],
        summary: "Update document configuration",
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
      const prisma = fastify.prisma;
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
        const parsed = updateLenderDocumentConfigSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        // ✅ Fetch existing config with ownership validation
        const existing =
          await prisma.lenderDocumentRequirement.findFirst({
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
            message: "Document config not found",
          });
        }

        // ✅ Build update object safely (NO undefined overwrite)
        const updateData = {};

        if (parsed.data.isRequired !== undefined)
          updateData.isRequired = parsed.data.isRequired;

        if (parsed.data.minFiles !== undefined)
          updateData.minFiles = parsed.data.minFiles;

        if (parsed.data.maxFiles !== undefined)
          updateData.maxFiles = parsed.data.maxFiles;

        if (parsed.data.notes !== undefined)
          updateData.notes = parsed.data.notes;

        if (parsed.data.sortOrder !== undefined)
          updateData.sortOrder = parsed.data.sortOrder;

        if (parsed.data.isActive !== undefined)
          updateData.isActive = parsed.data.isActive;

        // ✅ Update
        const updated =
          await prisma.lenderDocumentRequirement.update({
            where: { id: req.params.id },
            data: updateData,
          });

        return reply.send({
          success: true,
          message: "Document configuration updated",
          data: updated,
        });
      } catch (error) {
        console.error("DOCUMENT CONFIG UPDATE ERROR:", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while updating document config",
        });
      }
    }
  );
}

module.exports = updateLenderDocumentConfigRoutes;
