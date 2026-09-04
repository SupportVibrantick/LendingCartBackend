const {
  saveSignFormValuesSchema,
  saveSignFormDraftSchema,
  analyzeSignFormSchema,
} = require("../../../schemas/documents/signForm.schema");
const {
  getFormForRequirement,
  ensureDraftFormForRequirement,
  saveDraftForm,
  publishForm,
} = require("../../../services/documents/signForm/formService");
const {
  analyzeAndSaveDraftForm,
  getDetectionCapabilities,
} = require("../../../services/documents/signForm/detectFields.service");
const { getSignFormLimits } = require("../../../services/documents/signForm/limits");
const {
  annotateFieldsForRole,
  computeProgress,
  getOrCreateDraftSubmission,
  missingRequiredFields,
  saveSubmissionValues,
  finalizeFormIfComplete,
  valuesMapFromSubmission,
  fieldEditableByRole,
} = require("../../../services/documents/signForm/submissionService");
const {
  formatSignDocumentRequirement,
  REQUEST_APPLICATION_LENDER_INCLUDE,
} = require("../../../utils/documents/formatSignDocument");
const {
  notifyBrokerFormProgress,
} = require("../../../services/documents/signForm/signDocumentNotify");

const MAPPING_ALLOWED_STATUSES = ["AWAITING_BROKER"];

async function loadBrokerRequirementBase(fastify, {
  submissionId,
  requirementId,
  brokerOrgId,
}) {
  const submission = await fastify.prisma.applicationSubmission.findUnique({
    where: { id: submissionId },
    include: {
      application: {
        select: {
          id: true,
          brokerOrgId: true,
          applicationNumber: true,
        },
      },
    },
  });

  if (!submission || submission.application.brokerOrgId !== brokerOrgId) {
    return { error: { code: 403, message: "Access denied" } };
  }

  const requirement =
    await fastify.prisma.applicationDocumentRequirement.findFirst({
      where: {
        id: requirementId,
        loanApplicationId: submission.application.id,
        requiresClientSignature: true,
      },
      include: {
        documentType: true,
        activeFormVersion: true,
        signFormDefinition: true,
        requestApplicationLender: {
          include: REQUEST_APPLICATION_LENDER_INCLUDE,
        },
        uploads: {
          where: { isSignedOutput: true },
          orderBy: { uploadedAt: "desc" },
        },
      },
    });

  if (!requirement) {
    return { error: { code: 404, message: "Sign document not found" } };
  }

  return { submission, requirement };
}

async function loadBrokerRequirement(fastify, {
  submissionId,
  requirementId,
  brokerOrgId,
}) {
  const loaded = await loadBrokerRequirementBase(fastify, {
    submissionId,
    requirementId,
    brokerOrgId,
  });
  if (loaded.error) return loaded;

  const { requirement } = loaded;

  if (requirement.signMode !== "DYNAMIC_FORM") {
    return {
      error: { code: 400, message: "This document is not a fillable form" },
    };
  }

  if (!requirement.activeFormVersionId || !requirement.activeFormVersion) {
    return {
      error: {
        code: 400,
        message: "Published fillable form not found",
      },
    };
  }

  return loaded;
}

async function loadBrokerRequirementForMapping(fastify, {
  submissionId,
  requirementId,
  brokerOrgId,
}) {
  const loaded = await loadBrokerRequirementBase(fastify, {
    submissionId,
    requirementId,
    brokerOrgId,
  });
  if (loaded.error) return loaded;

  const { requirement } = loaded;

  if (!requirement.templateFileUrl) {
    return { error: { code: 400, message: "Template file is missing" } };
  }

  if (
    requirement.signStatus &&
    !MAPPING_ALLOWED_STATUSES.includes(requirement.signStatus)
  ) {
    return {
      error: {
        code: 400,
        message: "Fields can only be mapped before sending to the client",
      },
    };
  }

  if (
    requirement.source !== "BROKER_ADDED" &&
    requirement.signMode !== "DYNAMIC_FORM"
  ) {
    return {
      error: {
        code: 400,
        message: "Only broker-uploaded forms can be mapped here",
      },
    };
  }

  return loaded;
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function brokerSignFormRoutes(fastify) {
  fastify.get(
    "/submissions/:submissionId/sign-documents/:requirementId/form",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const { submissionId, requirementId } = req.params;
        const loaded = await loadBrokerRequirement(fastify, {
          submissionId,
          requirementId,
          brokerOrgId: req.user.organizationId,
        });

        if (loaded.error) {
          return reply.code(loaded.error.code).send({
            success: false,
            message: loaded.error.message,
          });
        }

        const form = await getFormForRequirement(
          fastify.prisma,
          requirementId,
          { preferPublished: true },
        );

        const draft = await getOrCreateDraftSubmission(fastify.prisma, {
          requirementId,
          formVersionId: form.versionId,
        });
        const values = valuesMapFromSubmission(draft);
        const progress = computeProgress(form.schema, values);
        const fields = annotateFieldsForRole(
          form.schema?.fields || [],
          "broker",
          values,
          form.schema,
        );

        return reply.send({
          success: true,
          data: {
            ...form,
            schema: {
              ...form.schema,
              fields,
            },
            progress,
            readOnly: ["FORWARDED_TO_LENDER", "LENDER_SEEN"].includes(
              loaded.requirement.signStatus,
            ),
            submission: {
              id: draft.id,
              status: draft.status,
              values,
            },
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

  fastify.put(
    "/submissions/:submissionId/sign-documents/:requirementId/form/values",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const { submissionId, requirementId } = req.params;
        const parsed = saveSignFormValuesSchema.safeParse(req.body || {});
        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message: "Invalid values payload",
            errors: parsed.error.flatten(),
          });
        }

        const loaded = await loadBrokerRequirement(fastify, {
          submissionId,
          requirementId,
          brokerOrgId: req.user.organizationId,
        });

        if (loaded.error) {
          return reply.code(loaded.error.code).send({
            success: false,
            message: loaded.error.message,
          });
        }

        if (
          ["FORWARDED_TO_LENDER", "LENDER_SEEN"].includes(
            loaded.requirement.signStatus,
          )
        ) {
          return reply.code(400).send({
            success: false,
            message: "Form is already forwarded and locked",
          });
        }

        const schema = loaded.requirement.activeFormVersion.schemaJson;
        const editableFields = (schema?.fields || []).filter((field) =>
          fieldEditableByRole(field, "broker"),
        );

        if (parsed.data.complete) {
          const draftPreview = await getOrCreateDraftSubmission(fastify.prisma, {
            requirementId,
            formVersionId: loaded.requirement.activeFormVersionId,
          });
          const merged = {
            ...valuesMapFromSubmission(draftPreview),
            ...parsed.data.values,
          };
          const missing = missingRequiredFields(schema, merged, "broker");
          if (missing.length) {
            return reply.code(400).send({
              success: false,
              message: `${missing[0].label || missing[0].key} is required`,
            });
          }
        }

        const draft = await getOrCreateDraftSubmission(fastify.prisma, {
          requirementId,
          formVersionId: loaded.requirement.activeFormVersionId,
        });

        const updatedSubmission = await saveSubmissionValues(fastify.prisma, {
          submissionId: draft.id,
          values: parsed.data.values,
          role: "broker",
          userId: req.user.userId || req.user.id,
          editableFields,
        });

        const values = valuesMapFromSubmission(updatedSubmission);
        const progress = computeProgress(schema, values);

        // While awaiting broker → client handoff, never finalize.
        // Final PDF is created when the client submits (or broker explicitly
        // completes after the form was already sent to the client).
        let finalizeResult = {
          finalized: false,
          progress,
          requirement: loaded.requirement,
          signedUpload: null,
          submission: updatedSubmission,
        };

        const status = loaded.requirement.signStatus;
        const canFinalizeFromBroker =
          parsed.data.complete === true &&
          (status === "SENT_TO_CLIENT" || status === "CLIENT_SIGNED");

        if (canFinalizeFromBroker) {
          finalizeResult = await finalizeFormIfComplete(fastify.prisma, {
            requirement: loaded.requirement,
            schema,
            submission: updatedSubmission,
          });

          if (finalizeResult.finalized && !finalizeResult.alreadyFinal) {
            await notifyBrokerFormProgress({
              prisma: fastify.prisma,
              io: fastify.io,
              requirement: loaded.requirement,
              brokerOrgId: loaded.submission.application.brokerOrgId,
              application: loaded.submission.application,
              finalized: true,
              awaitingBrokerFields: false,
              logger: fastify.log,
            });
          }
        }

        const stillAwaitingBroker = status === "AWAITING_BROKER";
        return reply.send({
          success: true,
          message: finalizeResult.finalized
            ? "Form completed — ready to forward to lender"
            : stillAwaitingBroker
              ? parsed.data.complete
                ? "Draft saved — send to client when ready"
                : "Draft saved"
              : parsed.data.complete
                ? "Broker fields saved"
                : "Draft saved",
          data: {
            progress: finalizeResult.progress || progress,
            finalized: Boolean(finalizeResult.finalized),
            submission: {
              id: updatedSubmission.id,
              status:
                finalizeResult.submission?.status || updatedSubmission.status,
              values,
            },
            requirement: formatSignDocumentRequirement(
              finalizeResult.requirement || loaded.requirement,
              { viewer: "broker" },
            ),
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to save form values",
        });
      }
    },
  );

  // --- Manual / DocuSign-style field mapping ---

  fastify.get(
    "/submissions/:submissionId/sign-documents/:requirementId/form/map",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const { submissionId, requirementId } = req.params;
        const loaded = await loadBrokerRequirementForMapping(fastify, {
          submissionId,
          requirementId,
          brokerOrgId: req.user.organizationId,
        });

        if (loaded.error) {
          return reply.code(loaded.error.code).send({
            success: false,
            message: loaded.error.message,
          });
        }

        let form = await getFormForRequirement(fastify.prisma, requirementId, {
          preferPublished: false,
        });

        if (!form?.definitionId || !form?.versionId) {
          form = await ensureDraftFormForRequirement(fastify.prisma, {
            requirement: loaded.requirement,
            organizationId: req.user.organizationId,
            title:
              loaded.requirement.signDocumentTitle ||
              loaded.requirement.documentType?.name,
          });
        } else if (form.versionStatus === "PUBLISHED") {
          form = await ensureDraftFormForRequirement(fastify.prisma, {
            requirement: loaded.requirement,
            organizationId: req.user.organizationId,
            title:
              loaded.requirement.signDocumentTitle ||
              loaded.requirement.documentType?.name,
          });
        }

        return reply.send({ success: true, data: form });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to load form mapper",
        });
      }
    },
  );

  fastify.get(
    "/submissions/:submissionId/sign-documents/:requirementId/form/detect-capabilities",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
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

  fastify.put(
    "/submissions/:submissionId/sign-documents/:requirementId/form/schema",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const { submissionId, requirementId } = req.params;
        const loaded = await loadBrokerRequirementForMapping(fastify, {
          submissionId,
          requirementId,
          brokerOrgId: req.user.organizationId,
        });

        if (loaded.error) {
          return reply.code(loaded.error.code).send({
            success: false,
            message: loaded.error.message,
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
    "/submissions/:submissionId/sign-documents/:requirementId/form/analyze",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const { submissionId, requirementId } = req.params;
        const loaded = await loadBrokerRequirementForMapping(fastify, {
          submissionId,
          requirementId,
          brokerOrgId: req.user.organizationId,
        });

        if (loaded.error) {
          return reply.code(loaded.error.code).send({
            success: false,
            message: loaded.error.message,
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
          options: {
            ...parsed.data,
            useAzure: parsed.data.useAzure === true,
            useLlm: parsed.data.useLlm === true,
            useFreeOcr: parsed.data.useFreeOcr !== false,
          },
        });

        return reply.send({
          success: true,
          message: result.fieldCount
            ? `Detected ${result.fieldCount} field${result.fieldCount === 1 ? "" : "s"}. Review before publishing.`
            : "No fields detected. Add fields manually.",
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

  fastify.post(
    "/submissions/:submissionId/sign-documents/:requirementId/form/publish",
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const { submissionId, requirementId } = req.params;
        const loaded = await loadBrokerRequirementForMapping(fastify, {
          submissionId,
          requirementId,
          brokerOrgId: req.user.organizationId,
        });

        if (loaded.error) {
          return reply.code(loaded.error.code).send({
            success: false,
            message: loaded.error.message,
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
                include: REQUEST_APPLICATION_LENDER_INCLUDE,
              },
              activeFormVersion: true,
              signFormSubmissions: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: { values: true },
              },
            },
          });

        return reply.send({
          success: true,
          message: `Form published with ${form.schema?.fields?.length || 0} field${(form.schema?.fields?.length || 0) === 1 ? "" : "s"}`,
          data: {
            form,
            requirement: formatSignDocumentRequirement(requirement, {
              viewer: "broker",
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
};
