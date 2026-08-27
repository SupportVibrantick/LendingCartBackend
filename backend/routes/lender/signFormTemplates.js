const {
  updateLibraryTemplateSchema,
} = require("../../schemas/documents/signForm.schema");
const {
  listLibraryTemplates,
  getLibraryTemplate,
  updateLibraryTemplate,
} = require("../../services/documents/signForm/libraryTemplate.service");
const { getSignFormLimits } = require("../../services/documents/signForm/limits");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function lenderSignFormTemplateRoutes(fastify) {
  fastify.get("/", async (req, reply) => {
    try {
      if (!req.user || req.user.orgType !== "LENDER") {
        return reply.code(403).send({
          success: false,
          message: "Lender access only",
        });
      }

      const includeArchived = String(req.query?.includeArchived || "") === "true";
      const data = await listLibraryTemplates(
        fastify.prisma,
        req.user.organizationId,
        { includeArchived },
      );

      return reply.send({
        success: true,
        data,
        meta: { limits: getSignFormLimits() },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || "Failed to list templates",
      });
    }
  });

  fastify.get("/:templateId", async (req, reply) => {
    try {
      if (!req.user || req.user.orgType !== "LENDER") {
        return reply.code(403).send({
          success: false,
          message: "Lender access only",
        });
      }

      const row = await getLibraryTemplate(
        fastify.prisma,
        req.user.organizationId,
        req.params.templateId,
      );
      if (!row) {
        return reply.code(404).send({
          success: false,
          message: "Template not found",
        });
      }

      return reply.send({ success: true, data: row });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || "Failed to load template",
      });
    }
  });

  fastify.patch("/:templateId", async (req, reply) => {
    try {
      if (!req.user || req.user.orgType !== "LENDER") {
        return reply.code(403).send({
          success: false,
          message: "Lender access only",
        });
      }

      const parsed = updateLibraryTemplateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid template update",
          errors: parsed.error.flatten(),
        });
      }

      const data = await updateLibraryTemplate(fastify.prisma, {
        organizationId: req.user.organizationId,
        templateId: req.params.templateId,
        patch: parsed.data,
        req,
      });

      return reply.send({
        success: true,
        message: parsed.data.status === "ARCHIVED" ? "Template archived" : "Template updated",
        data,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(error.statusCode || 500).send({
        success: false,
        message: error.message || "Failed to update template",
      });
    }
  });
};
