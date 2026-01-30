const fp = require("fastify-plugin");

/**
 * Public submit application API
 * - No auth
 * - Fully dynamic field support
 * - Defensive validation
 */
async function submitApplication(fastify) {
  fastify.post("/submit", async (req, reply) => {
    const { applicationId, applicationProductId, fields } = req.body;

    /* ===============================
       1. BASIC PAYLOAD VALIDATION
    =============================== */
    if (
      !applicationId ||
      !applicationProductId ||
      !Array.isArray(fields)
    ) {
      return reply.code(400).send({
        success: false,
        message: "Invalid payload structure",
      });
    }

    /* ===============================
       2. VERIFY ACTIVE APPLICATION + PRODUCT
    =============================== */
    const application =
      await fastify.prisma.brokerApplication.findFirst({
        where: {
          id: applicationId,
          isActive: true,
          products: {
            some: {
              id: applicationProductId,
              isActive: true,
            },
          },
        },
        select: {
          id: true,
        },
      });

    if (!application) {
      return reply.code(404).send({
        success: false,
        message: "Active application or product not found",
      });
    }

    /* ===============================
       3. FETCH DYNAMIC PRODUCT FIELDS
    =============================== */
    const productFields =
      await fastify.prisma.brokerApplicationProductField.findMany({
        where: {
          applicationProductId,
        },
      });

    const fieldMap = new Map(
      productFields.map((field) => [field.id, field])
    );

    /* ===============================
       4. REQUIRED FIELD VALIDATION
    =============================== */
    for (const field of productFields) {
      if (!field.isRequired) continue;

      const submitted = fields.find(
        (f) => f.fieldId === field.id
      );

      const isEmpty =
        !submitted ||
        submitted.value === undefined ||
        submitted.value === null ||
        (typeof submitted.value === "string" &&
          submitted.value.trim() === "") ||
        (Array.isArray(submitted.value) &&
          submitted.value.length === 0);

      if (isEmpty) {
        return reply.code(400).send({
          success: false,
          message: `Missing required field: ${field.label}`,
        });
      }
    }

    /* ===============================
       5. CREATE SUBMISSION (TRANSACTION)
    =============================== */
    const result = await fastify.prisma.$transaction(
      async (tx) => {
        const submission =
          await tx.applicationSubmission.create({
            data: {
              applicationId,
              applicationProductId,
              status: "SUBMITTED",
            },
          });

        const submissionFields = fields.map((f) => {
          const isDynamic =
            f.fieldId && fieldMap.has(f.fieldId);

          return {
            submissionId: submission.id,
            fieldId: isDynamic ? f.fieldId : null,
            fieldKey: f.fieldKey || null,
            value: JSON.stringify(f.value ?? null),
            source: isDynamic ? "DYNAMIC" : "STATIC",
          };
        });

        if (submissionFields.length > 0) {
          await tx.applicationSubmissionField.createMany({
            data: submissionFields,
          });
        }

        return submission;
      }
    );

    /* ===============================
       6. SUCCESS RESPONSE
    =============================== */
    return reply.code(201).send({
      success: true,
      message: "Application submitted successfully",
      data: {
        submissionId: result.id,
      },
    });
  });
}

module.exports = fp(submitApplication);
