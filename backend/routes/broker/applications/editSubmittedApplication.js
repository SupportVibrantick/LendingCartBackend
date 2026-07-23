const fp = require("fastify-plugin");
const { logAudit } = require("../../../services/logger/auditLogger");
const {
  canBrokerEditSubmittedApplication,
} = require("../../../utils/applications/resolveApplicationStatus");
const {
  loanApplicationFieldsSchema,
} = require("../../../schemas/broker/application/loanApplication.schema");

function formatValidationIssue(issue) {
  const field = issue.path
    .join(".")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase());

  const isString = issue.origin === "string";

  switch (issue.code) {
    case "too_big":
      return `${field} must be ${issue.inclusive ? "no more than" : "less than"} ${issue.maximum}${isString ? " characters" : ""}.`;

    case "too_small":
      return `${field} must be ${issue.inclusive ? "at least" : "more than"} ${issue.minimum}${isString ? " characters" : ""}.`;

    case "invalid_type":
      return `Please enter a valid ${field.toLowerCase()}.`;

    case "invalid_format":
      if (issue.format === "email") {
        return "Please enter a valid email address.";
      }

      if (issue.format === "regex" && issue.path[0] === "ssn") {
        return "SSN must be in the format XXX-XX-XXXX.";
      }

      if (issue.format === "date") {
        return "Please enter a valid date.";
      }

      return issue.message || `${field} is not in the correct format.`;

    case "invalid_value":
      return `Please select a valid ${field.toLowerCase()}.`;

    case "invalid_union": {
      const subMessages = issue.errors
        .flat()
        .map((e) => e.message)
        .filter((msg, i, arr) => arr.indexOf(msg) === i);

      return subMessages.length
        ? subMessages.join(" or ")
        : issue.message || `Please enter a valid ${field.toLowerCase()}.`;
    }

    default:
      return (
        issue.message || `Please correct the ${field.toLowerCase()} field.`
      );
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
          const firstIssue = validation.error.issues[0];

          return reply.code(400).send({
            success: false,
            message: firstIssue.message,
            errors: validation.error.issues.map((issue) => ({
              field: issue.path.join("."),
              reason: issue.message,
            })),
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
