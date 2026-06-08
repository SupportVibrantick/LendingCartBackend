const fp = require("fastify-plugin");
const jwt = require("jsonwebtoken");
const {
  notifyBroker,
  BROKER_NOTIFICATION_EVENTS,
} = require("../../services/brokerNotifications");

// ADDED (Fee Agreement)
const createFeeAgreement = require("../../routes/broker/loanPipeline/feeAgreement/createFeeAgreement");

async function submitClientApplication(fastify) {
  fastify.post(
    "/e-sign/submit",
    {
      schema: {
        tags: ["Client Portal"],
        summary: "Client submits application with signature (Token or JWT)",
        body: {
          type: "object",
          required: ["signature"],
          properties: {
            token: { type: "string" },
            loanApplicationId: { type: "string" }, //  FIXED
            signature: { type: "string", minLength: 5 }
          }
        }
      }
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const { token, signature, loanApplicationId } = req.body;

        /* ===============================
           VALIDATION
        =============================== */

        if (!signature) {
          return reply.code(400).send({
            success: false,
            message: "Signature is required"
          });
        }

        if (
          !signature.startsWith("data:image") &&
          signature !== "test-signature"
        ) {
          return reply.code(400).send({
            success: false,
            message: "Invalid signature format"
          });
        }

        let loan;
        let submission;
        let tokenRecord = null;

        /* =========================================
           TOKEN FLOW
        ========================================= */

        if (token) {
          tokenRecord = await prisma.clientUploadToken.findUnique({
            where: { token },
            include: {
              loanApplication: {
                include: { submissions: true }
              }
            }
          });

          if (!tokenRecord) {
            return reply.code(404).send({
              success: false,
              message: "Invalid or expired link"
            });
          }

          if (tokenRecord.expiresAt < new Date()) {
            return reply.code(400).send({
              success: false,
              message: "This link has expired"
            });
          }

          if (tokenRecord.isUsed) {
            return reply.code(400).send({
              success: false,
              message: "This link has already been used"
            });
          }

          loan = tokenRecord.loanApplication;
        }

        /* =========================================
           JWT FLOW (FIXED)
        ========================================= */

        else if (req.headers.authorization) {
          const authHeader = req.headers.authorization;
          const jwtToken = authHeader.split(" ")[1];

          let decoded;

          try {
            decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);
          } catch (err) {
            return reply.code(401).send({
              success: false,
              message: "Invalid token"
            });
          }

          const { clientId } = decoded;

          if (!clientId || !loanApplicationId) {
            return reply.code(400).send({
              success: false,
              message: "Missing loanApplicationId"
            });
          }

          loan = await prisma.loanApplication.findFirst({
            where: {
              id: loanApplicationId, // FIXED
              clientId
            },
            include: { submissions: true }
          });

          if (!loan) {
            return reply.code(404).send({
              success: false,
              message: "Loan not found"
            });
          }
        }

        else {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized"
          });
        }

        /* =========================================
           COMMON VALIDATION
        ========================================= */

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan not found"
          });
        }

        if (["SUBMITTED", "COMPLETED"].includes(loan.status)) {
          return reply.code(400).send({
            success: false,
            message: "Application already submitted"
          });
        }

        /* =========================================
           GET LATEST PENDING SUBMISSION
        ========================================= */

        submission = loan.submissions
          .filter(s => s.status === "CLIENT_PENDING")
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

        if (!submission) { 
          return reply.code(404).send({
            success: false,
            message: "No pending submission found"
          });
        }

        /* =========================================
           TRANSACTION
        ========================================= */

        await prisma.$transaction(async (tx) => {

          /* TOKEN SAFETY */
          if (tokenRecord) {
            const updated = await tx.clientUploadToken.updateMany({
              where: {
                token,
                isUsed: false
              },
              data: { isUsed: true }
            });

            if (updated.count === 0) {
              throw new Error("Token already consumed");
            }
          }

          /* REMOVE OLD SIGNATURE */
          await tx.applicationSubmissionField.deleteMany({
            where: {
              submissionId: submission.id,
              fieldKey: "borrowerSignature"
            }
          });

          /* SAVE SIGNATURE */
          await tx.applicationSubmissionField.create({
            data: {
              submissionId: submission.id,
              fieldKey: "borrowerSignature",
              value: signature,
              source: "CLIENT"
            }
          });

          /* UPDATE LOAN */
          await tx.loanApplication.update({
            where: { id: loan.id },
            data: {
              status: "SUBMITTED",
              submittedAt: new Date()
            }
          });

          /* UPDATE SUBMISSION */
          await tx.applicationSubmission.update({
            where: { id: submission.id },
            data: {
              status: "COMPLETED"
            }
          });
        });

        //  ADDED (Fee Agreement creation - SAFE)
        try {
          await createFeeAgreement(fastify, loan.id);
        } catch (err) {
          fastify.log.error(
            { error: err.message },
            "Fee Agreement creation failed (non-blocking)"
          );
        }

        await notifyBroker(prisma, fastify.io, {
          brokerOrgId: loan.brokerOrgId,
          eventType: BROKER_NOTIFICATION_EVENTS.APPLICATION_SUBMITTED,
          category: "APPLICATION",
          subject: "Application Submitted",
          body: `Client submitted application ${loan.applicationNumber}`,
          metadata: {
            applicationId: loan.id,
            applicationNumber: loan.applicationNumber,
            clientName: loan.client?.legalName || null,
          },
        });

        return reply.send({
          success: true,
          message: "Application submitted successfully"
        });

      } catch (error) {
        fastify.log.error({
          message: error.message,
          stack: error.stack
        });

        if (error.message === "Token already consumed") {
          return reply.code(400).send({
            success: false,
            message: "This link has already been used"
          });
        }

        return reply.code(500).send({
          success: false,
          message: "Failed to submit application"
        });
      }
    }
  );
}

module.exports = fp(submitClientApplication);