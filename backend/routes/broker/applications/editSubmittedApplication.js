const fp = require("fastify-plugin");
const { logAudit } = require("../../../services/logger/auditLogger");
const {
  canBrokerEditSubmittedApplication,
} = require("../../../utils/applications/resolveApplicationStatus");
const {
  loanApplicationFieldsSchema,
} = require("../../../schemas/broker/application/loanApplication.schema");

function formatValidationIssue(issue, receivedValue) {
  const field = issue.path.join(".");
  const received =
    receivedValue === undefined ? "no value" : JSON.stringify(receivedValue);
  const isStringLength = issue.origin === "string";

  switch (issue.code) {
    case "too_big":
      return `${field} must be ${issue.inclusive ? "at most" : "less than"} ${issue.maximum}${isStringLength ? " character(s)" : ""}. Received ${received}`;

    case "too_small":
      return `${field} must be ${issue.inclusive ? "at least" : "greater than"} ${issue.minimum}${isStringLength ? " character(s)" : ""}. Received ${received}`;

    case "invalid_type":
      return `${field} must be a valid ${issue.expected}. Received ${received}`;

    case "invalid_format":
      if (issue.format === "email") {
        return `${field} must be a valid email address. Received ${received}`;
      }
      if (issue.format === "regex" && field === "ssn") {
        return `${field} must be in format XXX-XX-XXXX. Received ${received}`;
      }
      if (issue.format === "date") {
        return `${field} must be a valid date (YYYY-MM-DD). Received ${received}`;
      }
      return `${field} is not in the correct format. Received ${received}`;

    case "invalid_value":
      return `${field} must be one of: ${issue.values.join(", ")}. Received ${received}`;

    case "invalid_union": {
      // Union fields (e.g. dscrCalculationMethod: enum OR free-text string).
      // Collapse each branch's sub-errors into one readable line.
      const subMessages = issue.errors
        .flat()
        .map((e) => e.message)
        .filter((msg, i, arr) => arr.indexOf(msg) === i);
      return `${field} is invalid �� it must satisfy one of: ${subMessages.join(" OR ")}. Received ${received}`;
    }

    default:
      return `${field}: ${issue.message}. Received ${received}`;
  }
}

async function editSubmittedApplication(fastify) {
  fastify.put(
    "/:applicationId/edit",
    {
      schema: {
        tags: ["Broker -> Applications"],
        summary: "Edit Submitted Loan Application",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /*  AUTH  */
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const { applicationId } = req.params;
        const { fields } = req.body;

        /*  VALIDATION  */

        if (!applicationId) {
          return reply.code(400).send({
            success: false,
            message: "Application ID is required",
          });
        }

        if (!Array.isArray(fields) || fields.length === 0) {
          return reply.code(400).send({
            success: false,
            message: "Fields array is required",
          });
        }

        const staticFieldsMap = {};
        for (const f of fields) {
          if (f.fieldKey) {
            staticFieldsMap[f.fieldKey] = f.value;
          }
        }

        const validation = loanApplicationFieldsSchema
          .partial()
          .safeParse(staticFieldsMap);

        if (!validation.success) {
          return reply.code(400).send({
            success: false,
            message: "One or more fields are invalid",
            errors: validation.error.issues.map((issue) => {
              const field = issue.path.join(".");
              return {
                field,
                reason: formatValidationIssue(issue, staticFieldsMap[field]),
              };
            }),
          });
        }

        /*    FETCH APPLICATION    */

        const application = await prisma.loanApplication.findFirst({
          where: {
            id: applicationId,
            brokerOrgId,
          },
          include: {
            applicationLenders: {
              select: { status: true },
            },
            submissions: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        if (!application) {
          return reply.code(404).send({
            success: false,
            message: "Application not found or unauthorized",
          });
        }

        /*    BUSINESS RULES    */

        const editCheck = canBrokerEditSubmittedApplication(application);
        if (!editCheck.allowed) {
          return reply.code(400).send({
            success: false,
            message: editCheck.reason,
          });
        }

        const latestSubmission = application.submissions[0];

        if (!latestSubmission) {
          return reply.code(400).send({
            success: false,
            message: "No submission found to edit",
          });
        }

        /*    TRANSACTION    */

        const result = await prisma.$transaction(async (tx) => {
          /*  Create NEW submission version */

          const newSubmission = await tx.applicationSubmission.create({
            data: {
              applicationId: application.id,
              applicationProductId: latestSubmission.applicationProductId,
              status:
                application.status === "DRAFT" ? "CLIENT_PENDING" : "UPDATED",
            },
          });

          /*  Prepare fields */

          const submissionFields = fields.map((f) => ({
            submissionId: newSubmission.id,
            fieldId: f.fieldId || null,
            fieldKey: f.fieldKey || null,
            value: f.value ?? null,
            source: f.fieldId ? "DYNAMIC" : "STATIC",
          }));

          /*  Insert fields */

          if (submissionFields.length > 0) {
            await tx.applicationSubmissionField.createMany({
              data: submissionFields,
            });
          }

          /*  (Optional but recommended) mark old submission */

          await tx.applicationSubmission.update({
            where: { id: latestSubmission.id },
            data: { status: "SUPERSEDED" },
          });

          return { newSubmission };
        });

        /*    AUDIT    */

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "APPLICATION",
          entityType: "LoanApplication",
          entityId: applicationId,
          action: "EDIT_SUBMITTED_APPLICATION",
          newValue: {
            submissionId: result.newSubmission.id,
          },
        });

        /*    SUCCESS    */

        return reply.send({
          success: true,
          message: "Application edited successfully",
          data: {
            submissionId: result.newSubmission.id,
            application,
          },
        });
      } catch (error) {

        /*  ERROR HANDLING  */

        fastify.log.error({
          message: error.message,
          stack: error.stack,
          route: "EDIT_SUBMITTED_APPLICATION",
          userId: req.user?.id,
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error while editing application",
        });
      }
    },
  );
}

module.exports = fp(editSubmittedApplication);
