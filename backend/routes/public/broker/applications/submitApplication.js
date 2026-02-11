const fp = require("fastify-plugin");
const axios = require("axios");
const { randomUUID } = require("crypto");

async function submitApplication(fastify) {
  fastify.post("/submit", async (req, reply) => {
    const {
      applicationId: brokerApplicationId, // template ID
      applicationProductId,
      fields,
      captchaToken,
    } = req.body;

    /* ===============================
       0. CAPTCHA VALIDATION
    =============================== */
    if (!captchaToken) {
      return reply.code(400).send({
        success: false,
        message: "Captcha token is required",
      });
    }

    try {
      const captchaRes = await axios.post(
        "https://www.google.com/recaptcha/api/siteverify",
        null,
        {
          params: {
            secret: process.env.RECAPTCHA_SECRET_KEY,
            response: captchaToken,
          },
        }
      );

      if (
        !captchaRes.data.success ||
        (captchaRes.data.score !== undefined &&
          captchaRes.data.score < 0.5)
      ) {
        return reply.code(403).send({
          success: false,
          message: "Captcha verification failed",
        });
      }
    } catch (err) {
      fastify.log.error("Captcha verification error", err);
      return reply.code(500).send({
        success: false,
        message: "Captcha verification failed",
      });
    }

    /* ===============================
       1. BASIC VALIDATION
    =============================== */
    if (!brokerApplicationId || !applicationProductId || !Array.isArray(fields)) {
      return reply.code(400).send({
        success: false,
        message: "Invalid payload structure",
      });
    }

    /* ===============================
       2. VERIFY TEMPLATE
    =============================== */
    const brokerApplication =
      await fastify.prisma.brokerApplication.findFirst({
        where: {
          id: brokerApplicationId,
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
          brokerOrgId: true,
        },
      });

    if (!brokerApplication) {
      return reply.code(404).send({
        success: false,
        message: "Active application or product not found",
      });
    }

    /* ===============================
       3. FETCH PRODUCT FIELDS
    =============================== */
    const productFields =
      await fastify.prisma.brokerApplicationProductField.findMany({
        where: { applicationProductId },
      });

    const fieldMap = new Map(
      productFields.map((field) => [field.id, field])
    );

    /* ===============================
       4. REQUIRED FIELD VALIDATION
    =============================== */
    for (const field of productFields) {
      if (!field.isRequired) continue;

      const submitted = fields.find((f) => f.fieldId === field.id);

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
       5. TRANSACTION
    =============================== */
    const result = await fastify.prisma.$transaction(async (tx) => {
      
      // Example: Extract email + name from fields
      const emailField = fields.find(f => f.fieldKey === "email");
      const nameField = fields.find(f => f.fieldKey === "full_name");

      if (!emailField?.value) {
        throw new Error("Email is required to create client");
      }

      // Create or reuse client
      const client = await tx.client.upsert({
        where: { email: emailField.value },
        update: {},
        create: {
          id: randomUUID(),
          email: emailField.value,
          fullName: nameField?.value || "Unknown Applicant",
        },
      });

      // Create loan application
      const loanApplication = await tx.loanApplication.create({
        data: {
          id: randomUUID(),
          applicationNumber: `APP-${Date.now()}`,
          brokerOrgId: brokerApplication.brokerOrgId,
          clientId: client.id,
          loanProductCode: "DRAFT", // use correct enum
          status: "SUBMITTED",
          updatedAt: new Date(),
        },
      });

      // Create submission
      const submission = await tx.applicationSubmission.create({
        data: {
          applicationId: loanApplication.id,
          applicationProductId,
          status: "NEW",
        },
      });

      // Create fields
      const submissionFields = fields.map((f) => ({
        submissionId: submission.id,
        fieldId: f.fieldId && fieldMap.has(f.fieldId) ? f.fieldId : null,
        fieldKey: f.fieldKey || null,
        value: JSON.stringify(f.value ?? null),
        source: f.fieldId ? "DYNAMIC" : "STATIC",
      }));

      if (submissionFields.length > 0) {
        await tx.applicationSubmissionField.createMany({
          data: submissionFields,
        });
      }

      return submission;
    });

    /* ===============================
       6. SUCCESS
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