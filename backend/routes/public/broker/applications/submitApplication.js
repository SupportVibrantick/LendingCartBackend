const fp = require("fastify-plugin");
const {
  buildSubmissionFieldsPayload,
  loadProductFieldIdMap,
} = require("../../../../services/applications/staticSubmissionFields");
const { randomUUID } = require("crypto");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../../services/notifications/brokerNotifications");

async function submitApplication(fastify) {
  fastify.post("/submit", async (req, reply) => {
    const {
      applicationId: brokerApplicationId,
      applicationProductId,
      fields,
    } = req.body;

    if (!brokerApplicationId || !applicationProductId || !Array.isArray(fields)) {
      return reply.code(400).send({
        success: false,
        message: "Invalid payload",
      });
    }

    // Validate Template + Product
    const brokerProduct =
      await fastify.prisma.brokerApplicationProduct.findFirst({
        where: {
          id: applicationProductId,
          isActive: true,
          brokerApplication: {
            id: brokerApplicationId,
            isActive: true,
          },
        },
        select: {
          id: true,
          loanProductCode: true,
          brokerApplication: {
            select: { brokerOrgId: true },
          },
        },
      });

    if (!brokerProduct) {
      return reply.code(404).send({
        success: false,
        message: "Invalid application product",
      });
    }

    const result = await fastify.prisma.$transaction(async (tx) => {
      // Extract required fields
      const emailField = fields.find(
        (f) => f.fieldKey === "email" || f.fieldKey === "borrowerEmail",
      );
      const firstNameField = fields.find(
        (f) =>
          f.fieldKey === "first_name" ||
          f.fieldKey === "borrowerFirstName" ||
          f.fieldKey === "firstName",
      );
      const lastNameField = fields.find(
        (f) =>
          f.fieldKey === "last_name" ||
          f.fieldKey === "borrowerLastName" ||
          f.fieldKey === "lastName",
      );

      if (!emailField?.value) {
        throw new Error("Email is required");
      }

      // 1️⃣ Create Client
      const client = await tx.client.create({
        data: {
          id: randomUUID(),
          legalName:
            `${firstNameField?.value || ""} ${lastNameField?.value || ""}`.trim() ||
            "Individual Applicant",
          entityType: "INDIVIDUAL",
          primaryBrokerOrgId: brokerProduct.brokerApplication.brokerOrgId,
        },
      });

      // 2️⃣ Create Client Contact
      await tx.clientContact.create({
        data: {
          clientId: client.id,
          firstName: firstNameField?.value || "Applicant",
          lastName: lastNameField?.value || "",
          email: emailField.value,
          isPrimary: true,
        },
      });

      // 3️⃣ Create Loan Application
      const loanApplication = await tx.loanApplication.create({
        data: {
          id: randomUUID(),
          applicationNumber: `APP-${Date.now()}`,
          brokerOrgId: brokerProduct.brokerApplication.brokerOrgId,
          clientId: client.id,
          loanProductCode: brokerProduct.loanProductCode,
          status: "SUBMITTED",
        },
      });

      // 4️⃣ Create Submission
      const submission = await tx.applicationSubmission.create({
        data: {
          applicationId: loanApplication.id,
          applicationProductId,
          status: "NEW",
        },
      });

      // 5️⃣ Create Submission Fields
      const fieldIdByKey = await loadProductFieldIdMap(
        tx,
        applicationProductId,
      );

      const normalizedFields = buildSubmissionFieldsPayload(fields, fieldIdByKey);

      const submissionFields = normalizedFields.map((f) => ({
        submissionId: submission.id,
        ...f,
      }));

      if (submissionFields.length > 0) {
        await tx.applicationSubmissionField.createMany({
          data: submissionFields,
        });
      }

      return { submission, loanApplication, client, brokerOrgId: brokerProduct.brokerApplication.brokerOrgId };
    });

    await notifyBroker(fastify.prisma, fastify.io, {
      brokerOrgId: result.brokerOrgId,
      eventType: BROKER_NOTIFICATION_EVENTS.APPLICATION_SUBMITTED,
      category: "APPLICATION",
      subject: "New Application Submitted",
      body: `New application ${result.loanApplication.applicationNumber} submitted via public form`,
      metadata: {
        applicationId: result.loanApplication.id,
        applicationNumber: result.loanApplication.applicationNumber,
        clientName: result.client.legalName,
        source: "PUBLIC_FORM",
      },
    });

    return reply.code(201).send({
      success: true,
      message: "Application submitted successfully",
      data: { submissionId: result.submission.id },
    });
  });
}

module.exports = fp(submitApplication);