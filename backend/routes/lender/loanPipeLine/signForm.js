const {
  saveSignFormDraftSchema,
  analyzeSignFormSchema,
  saveAsTemplateSchema,
} = require("../../../schemas/documents/signForm.schema");
const {
  ensureDraftFormForRequirement,
  getFormForRequirement,
  saveDraftForm,
  publishForm,
} = require("../../../services/documents/signForm/formService");
const {
  analyzeAndSaveDraftForm,
  getDetectionCapabilities,
} = require("../../../services/documents/signForm/detectFields.service");
const {
  saveRequirementAsLibraryTemplate,
} = require("../../../services/documents/signForm/libraryTemplate.service");
const { getSignFormLimits } = require("../../../services/documents/signForm/limits");
const {
  computeProgress,
  valuesMapFromSubmission,
  annotateFieldsForRole,
} = require("../../../services/documents/signForm/submissionService");
const { logAudit } = require("../../../services/logger/auditLogger");
const {
  formatSignDocumentRequirement,
} = require("../../../utils/documents/formatSignDocument");

async function loadLenderRequirement(fastify, {
  applicationLenderId,
  requirementId,
  lenderOrgId,
}) {
  const applicationLender =
    await fastify.prisma.applicationLender.findFirst({
      where: { id: applicationLenderId, lenderOrgId },
      include: {
        lender: { select: { name: true } },
      },
    });

  if (!applicationLender) {
    return { error: { code: 404, message: "Application not found" } };
  }

  const requirement =
    await fastify.prisma.applicationDocumentRequirement.findFirst({
      where: {
        id: requirementId,
        loanApplicationId: applicationLender.loanApplicationId,
        requiresClientSignature: true,
        requestApplicationLenderId: applicationLenderId,
      },
      include: {
        documentType: true,
        signFormDefinition: true,
        activeFormVersion: true,
      },
    });

  if (!requirement) {
    return { error: { code: 404, message: "Sign document not found" } };
  }

  if (!requirement.templateFileUrl) {
    return { error: { code: 400, message: "Template file is missing" } };
  }

  return { applicationLender, requirement };
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function lenderSignFormRoutes(fastify) {
  fastify.get(
    "/:applicationLenderId/sign-documents/:requirementId/form",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const { applicationLenderId, requirementId } = req.params;
        const loaded = await loadLenderRequirement(fastify, {
          applicationLenderId,
          requirementId,
          lenderOrgId: req.user.organizationId,
        });

        if (loaded.error) {
          return reply.code(loaded.error.code).send({
            success: false,
            message: loaded.error.message,
          });
        }

        let form = await getFormForRequirement(
          fastify.prisma,
          requirementId,
          { preferPublished: true },
        );

        if (!form?.definitionId) {
          form = await ensureDraftFormForRequirement(fastify.prisma, {
            requirement: loaded.requirement,
            organizationId: req.user.organizationId,
            title:
              loaded.requirement.signDocumentTitle ||
              loaded.requirement.documentType?.name,
          });
        }

        let values = {};
        let progress = null;
        let submissionPayload = null;

        if (form?.versionId) {
          const submission =
            await fastify.prisma.signFormSubmission.findFirst({
              where: {
                requirementId,
                formVersionId: form.versionId,
              },
              include: { values: true },
              orderBy: { createdAt: "desc" },
            });

          if (submission) {
            values = valuesMapFromSubmission(submission);
            progress = computeProgress(form.schema, values);
            submissionPayload = {
              id: submission.id,
              status: submission.status,
              values,
            };
          } else if (form.schema) {
            progress = computeProgress(form.schema, {});
          }
        }

        const status = loaded.requirement.signStatus;
        const showFilledToLender =
          status === "FORWARDED_TO_LENDER" || status === "LENDER_SEEN";

        const fields = annotateFieldsForRole(
          form.schema?.fields || [],
          "broker",
          values,
          form.schema,
        ).map((field) => ({
          ...field,
          // Lender always views; never edits filled values here.
          editable: false,
          readOnly: true,
        }));

        return reply.send({
          success: true,
          data: {
            ...form,
            schema: {
              ...form.schema,
              fields,
            },
            progress,
            readOnly: true,
            showFilledValues: showFilledToLender || Object.keys(values).length > 0,
            submission: submissionPayload,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to load form",
        });
      }
    },
  );

  fastify.get(
    "/:applicationLenderId/sign-documents/:requirementId/form/detect-capabilities",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        return reply.send({
          success: true,
          data: {
            ...getDetectionCapabilities(),
            limits: getSignFormLimits(),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to load detection capabilities",
        });
      }
    },
  );

  fastify.post(
    "/:applicationLenderId/sign-documents/:requirementId/form/analyze",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const { applicationLenderId, requirementId } = req.params;
        const loaded = await loadLenderRequirement(fastify, {
          applicationLenderId,
          requirementId,
          lenderOrgId: req.user.organizationId,
        });

        if (loaded.error) {
          return reply.code(loaded.error.code).send({
            success: false,
            message: loaded.error.message,
          });
        }

        if (
          loaded.requirement.signStatus &&
          !["AWAITING_BROKER"].includes(loaded.requirement.signStatus)
        ) {
          return reply.code(400).send({
            success: false,
            message:
              "Field detection is only available while awaiting broker",
          });
        }

        const parsed = analyzeSignFormSchema.safeParse(req.body || {});
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message: "Invalid analyze options",
            errors: parsed.error.flatten(),
          });
        }

        const result = await analyzeAndSaveDraftForm(fastify, {
          requirement: loaded.requirement,
          organizationId: req.user.organizationId,
          actorUserId: req.user.userId || req.user.id,
          options: parsed.data,
        });

        const message = result.fieldCount
          ? `Detected ${result.fieldCount} field${result.fieldCount === 1 ? "" : "s"}. Review before publishing.`
          : "No fields detected. Add fields manually or check OCR configuration.";

        return reply.send({
          success: true,
          message,
          data: {
            form: result.form,
            detection: result.detection,
            fieldCount: result.fieldCount,
            formProcessingStatus: result.formProcessingStatus,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to analyze form",
        });
      }
    },
  );

  fastify.put(
    "/:applicationLenderId/sign-documents/:requirementId/form",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const { applicationLenderId, requirementId } = req.params;
        const loaded = await loadLenderRequirement(fastify, {
          applicationLenderId,
          requirementId,
          lenderOrgId: req.user.organizationId,
        });

        if (loaded.error) {
          return reply.code(loaded.error.code).send({
            success: false,
            message: loaded.error.message,
          });
        }

        if (
          loaded.requirement.signStatus &&
          !["AWAITING_BROKER"].includes(loaded.requirement.signStatus)
        ) {
          return reply.code(400).send({
            success: false,
            message:
              "Form fields can only be edited while awaiting broker",
          });
        }

        const parsed = saveSignFormDraftSchema.safeParse(req.body || {});
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message: "Invalid form schema",
            errors: parsed.error.flatten(),
          });
        }

        const form = await saveDraftForm(fastify.prisma, {
          requirement: loaded.requirement,
          organizationId: req.user.organizationId,
          schema: parsed.data.schema,
          pageManifest: parsed.data.pageManifest,
        });

        return reply.send({
          success: true,
          message: "Draft form saved",
          data: form,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to save form",
        });
      }
    },
  );

  fastify.post(
    "/:applicationLenderId/sign-documents/:requirementId/form/publish",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const { applicationLenderId, requirementId } = req.params;
        const loaded = await loadLenderRequirement(fastify, {
          applicationLenderId,
          requirementId,
          lenderOrgId: req.user.organizationId,
        });

        if (loaded.error) {
          return reply.code(loaded.error.code).send({
            success: false,
            message: loaded.error.message,
          });
        }

        if (
          loaded.requirement.signStatus &&
          !["AWAITING_BROKER"].includes(loaded.requirement.signStatus)
        ) {
          return reply.code(400).send({
            success: false,
            message: "Form can only be published while awaiting broker",
          });
        }

        let schema;
        let pageManifest;
        if (req.body?.schema) {
          const parsed = saveSignFormDraftSchema.safeParse(req.body);
          if (!parsed.success) {
            return reply.code(400).send({
              success: false,
              message: "Invalid form schema",
              errors: parsed.error.flatten(),
            });
          }
          schema = parsed.data.schema;
          pageManifest = parsed.data.pageManifest;
        }

        const form = await publishForm(fastify.prisma, {
          requirement: loaded.requirement,
          organizationId: req.user.organizationId,
          userId: req.user.userId || req.user.id,
          schema,
          pageManifest,
        });

        await logAudit({
          prisma: fastify.prisma,
          req,
          dashboard: "LENDER",
          category: "APPLICATION",
          entityType: "SignFormVersion",
          entityId: form.versionId || requirementId,
          action: "FORM_PUBLISHED",
          newValue: {
            requirementId,
            fieldCount: form.schema?.fields?.length || 0,
          },
        });

        const requirement =
          await fastify.prisma.applicationDocumentRequirement.findUnique({
            where: { id: requirementId },
            include: {
              documentType: true,
              uploads: {
                where: { isSignedOutput: true },
                orderBy: { uploadedAt: "desc" },
              },
              requestApplicationLender: {
                include: { lender: { select: { name: true } } },
              },
            },
          });

        return reply.send({
          success: true,
          message: "Form published",
          data: {
            form,
            requirement: formatSignDocumentRequirement(requirement, {
              viewer: "lender",
            }),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to publish form",
        });
      }
    },
  );

  fastify.post(
    "/:applicationLenderId/sign-documents/:requirementId/save-as-template",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const { applicationLenderId, requirementId } = req.params;
        const loaded = await loadLenderRequirement(fastify, {
          applicationLenderId,
          requirementId,
          lenderOrgId: req.user.organizationId,
        });

        if (loaded.error) {
          return reply.code(loaded.error.code).send({
            success: false,
            message: loaded.error.message,
          });
        }

        const parsed = saveAsTemplateSchema.safeParse(req.body || {});
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message: "Template name is required",
            errors: parsed.error.flatten(),
          });
        }

        const template = await saveRequirementAsLibraryTemplate(fastify.prisma, {
          requirement: loaded.requirement,
          organizationId: req.user.organizationId,
          userId: req.user.userId || req.user.id,
          name: parsed.data.name,
          description: parsed.data.description,
          req,
        });

        return reply.send({
          success: true,
          message: "Saved to template library",
          data: template,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(error.statusCode || 500).send({
          success: false,
          message: error.message || "Failed to save template",
        });
      }
    },
  );
};
