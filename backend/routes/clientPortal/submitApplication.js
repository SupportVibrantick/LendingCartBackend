const fp = require("fastify-plugin");
const jwt = require("jsonwebtoken");

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
            signature: { type: "string", minLength: 5 }
          }
        }
      }
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const { token, signature } = req.body;

        /* ===============================
           BASIC VALIDATION
        =============================== */

        if (!signature) {
          return reply.code(400).send({
            success: false,
            message: "Signature is required"
          });
        }

        // Optional strict validation (can relax if needed)
        if (!signature.startsWith("data:image") && signature !== "test-signature") {
          return reply.code(400).send({
            success: false,
            message: "Invalid signature format"
          });
        }

        let loan;
        let submission;
        let tokenRecord = null;

        /* =========================================
           CASE 1: TOKEN FLOW
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
           CASE 2: JWT FLOW
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

          const { clientId, loanId } = decoded;

          if (!clientId || !loanId) {
            return reply.code(400).send({
              success: false,
              message: "Invalid JWT payload"
            });
          }

          loan = await prisma.loanApplication.findFirst({
            where: {
              id: loanId,
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

        /* =========================================
           NO ACCESS METHOD
        ========================================= */

        else {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized"
          });
        }

        /* =========================================
           COMMON VALIDATIONS
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
           GET CORRECT SUBMISSION
        ========================================= */

        submission = loan.submissions
          .filter(s => s.status === "PENDING_CLIENT")
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

          /* TOKEN SAFETY FIRST (race condition safe) */
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

          /* REMOVE OLD SIGNATURE (IMPORTANT FIX) */
          await tx.applicationSubmissionField.deleteMany({
            where: {
              submissionId: submission.id,
              fieldKey: "borrowerSignature"
            }
          });

          /* SAVE NEW SIGNATURE */
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