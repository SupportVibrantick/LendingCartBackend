const fp = require("fastify-plugin");

/**
 * Public submit application API
 * No auth / no token
 */
async function submitApplication(fastify) {
  fastify.post("/submit", async (req, reply) => {
    const { applicationId, applicationProductId, fields } = req.body;

    // basic payload validation
    if (!applicationId || !applicationProductId || !Array.isArray(fields)) {
      return reply.code(400).send({
        success: false,
        message: "Invalid payload",
      });
    }

    // check active application & application product
    const application = await fastify.prisma.brokerApplication.findFirst({
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
    });

    if (!application) {
      return reply.code(404).send({
        success: false,
        message: "Active application or product not found",
      });
    }

    // fetch dynamic fields (CORRECT MODEL)
    const productFields =
      await fastify.prisma.brokerApplicationProductField.findMany({
        where: {
          applicationProductId,
        },
      });

    // map fields by id
    const fieldMap = new Map(productFields.map((f) => [f.id, f]));

    // validate required dynamic fields
    for (const field of productFields) {
      if (field.isRequired) {
        const submitted = fields.find(
          (f) => f.fieldId && f.fieldId === field.id
        );

        if (
          !submitted ||
          submitted.value === null ||
          submitted.value === ""
        ) {
          return reply.code(400).send({
            success: false,
            message: `Missing required field: ${field.label}`,
          });
        }
      }
    }

    // create submission
    const submission = await fastify.prisma.applicationSubmission.create({
      data: {
        applicationId,
        applicationProductId,
        status: "SUBMITTED",
      },
    });

    // prepare submission fields
    const submissionFields = fields.map((f) => {
      const isDynamic = !!f.fieldId && fieldMap.has(f.fieldId);

      return {
        submissionId: submission.id,
        fieldId: isDynamic ? f.fieldId : null,
        fieldKey: f.fieldKey,
        value: JSON.stringify(f.value),
        source: isDynamic ? "DYNAMIC" : "STATIC",
      };
    });

    // bulk insert fields
    await fastify.prisma.applicationSubmissionField.createMany({
      data: submissionFields,
    });

    return reply.send({
      success: true,
      message: "Application submitted successfully",
      data: {
        submissionId: submission.id,
      },
    });
  });
}

module.exports = fp(submitApplication);
