const fp = require("fastify-plugin");
const crypto = require("crypto");
const {
  buildSubmissionFieldsPayload,
  loadProductFieldIdMap,
} = require("../../../../services/applications/staticSubmissionFields");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../../../services/notifications/brokerNotifications");
const {
  createClientPortalToken,
  sendClientPortalAccessEmail,
} = require("../../../../services/emails/clientPortalAccessEmail");
const {
  resolveBorrowerNameParts,
  resolveClientDisplayName,
  resolveBorrowerEmail,
} = require("../../../../utils/applications/resolveBorrowerIdentity");

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
      const borrowerEmail = resolveBorrowerEmail(fields);
      const { firstName, lastName, displayName } =
        resolveBorrowerNameParts(fields);

      if (!borrowerEmail) {
        throw new Error("Email is required");
      }

      const legalName = displayName || "Individual Applicant";

      // 1️⃣ Create Client
      const client = await tx.client.create({
        data: {
          id: crypto.randomUUID(),
          legalName,
          entityType: "INDIVIDUAL",
          primaryBrokerOrgId: brokerProduct.brokerApplication.brokerOrgId,
        },
      });

      // 2️⃣ Create Client Contact
      await tx.clientContact.create({
        data: {
          clientId: client.id,
          firstName: firstName || "Applicant",
          lastName: lastName || "",
          email: borrowerEmail,
          isPrimary: true,
        },
      });

      // 3️⃣ Create Loan Application
      const loanApplication = await tx.loanApplication.create({
        data: {
          id: crypto.randomUUID(),
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

      const portalToken = await createClientPortalToken(tx, {
        loanApplicationId: loanApplication.id,
        clientId: client.id,
      });

      return {
        submission,
        loanApplication,
        client,
        brokerOrgId: brokerProduct.brokerApplication.brokerOrgId,
        borrowerEmail,
        portalToken,
        clientDisplayName: resolveClientDisplayName({
          client,
          fields,
        }),
      };
    });

    try {
      const brokerOrg = await fastify.prisma.organization.findUnique({
        where: { id: result.brokerOrgId },
        select: { name: true },
      });

      await sendClientPortalAccessEmail({
        prisma: fastify.prisma,
        to: result.borrowerEmail,
        clientName: result.clientDisplayName,
        applicationNumber: result.loanApplication.applicationNumber,
        brokerName: brokerOrg?.name,
        portalToken: result.portalToken,
        idempotencyKey: `public-submit-portal:${result.loanApplication.id}`,
      });

      fastify.log.info(
        {
          borrowerEmail: result.borrowerEmail,
          applicationId: result.loanApplication.id,
        },
        "Client portal access email enqueued after public application submit",
      );
    } catch (mailErr) {
      fastify.log.error(
        {
          error: mailErr.message,
          applicationId: result.loanApplication.id,
          borrowerEmail: result.borrowerEmail,
        },
        "Failed to send client portal email after public application submit",
      );
    }

    await notifyBroker(fastify.prisma, fastify.io, {
      brokerOrgId: result.brokerOrgId,
      eventType: BROKER_NOTIFICATION_EVENTS.APPLICATION_SUBMITTED,
      category: "APPLICATION",
      subject: "New Application Submitted",
      body: `New application ${result.loanApplication.applicationNumber} submitted via public form`,
      metadata: {
        applicationId: result.loanApplication.id,
        applicationNumber: result.loanApplication.applicationNumber,
        clientName: result.clientDisplayName,
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