module.exports = async function (fastify) {
  fastify.get(
    "/:loanId/fee-agreement",

    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],

      schema: {
        tags: ["Sub Broker → Fee Agreement"],

        summary: "Get Fee Agreement for assigned loan",

        params: {
          type: "object",

          required: ["loanId"],

          properties: {
            loanId: {
              type: "string",
            },
          },
        },
      },
    },

    async (req, reply) => {
      try {
        const prisma = fastify.prisma;

        const { loanId } = req.params;

        const userId = req.user.userId;

        /* ===============================
           AUTH CHECK
        =============================== */

        if (!req.user) {
          return reply.code(401).send({
            ok: false,

            message: "Unauthorized",
          });
        }

        /* ===============================
           VERIFY ASSIGNED APPLICATION
        =============================== */

        const assignment = await prisma.subBrokerApplication.findFirst({
          where: {
            loanApplicationId: loanId,

            subBrokerId: userId,
          },

          select: {
            id: true,

            loanApplicationId: true,
          },
        });

        if (!assignment) {
          return reply.code(403).send({
            ok: false,

            message: "Access denied. Application not assigned.",
          });
        }

        /* ===============================
           FETCH AGREEMENT
        =============================== */

        const agreement = await prisma.feeAgreement.findUnique({
          where: {
            loanApplicationId: loanId,
          },

          include: {
            loanApplication: {
              select: {
                id: true,

                applicationNumber: true,

                status: true,

                amountRequested: true,

                purpose: true,

                client: {
                  select: {
                    id: true,

                    legalName: true,

                    entityType: true,
                  },
                },
              },
            },
          },
        });

        if (!agreement) {
          return reply.code(404).send({
            ok: false,

            message: "Fee Agreement not found",
          });
        }

        /* ===============================
           SUCCESS RESPONSE
        =============================== */

        return reply.send({
          ok: true,

          data: {
            id: agreement.id,

            loanApplicationId: agreement.loanApplicationId,

            brokerOrgId: agreement.brokerOrgId,

            clientId: agreement.clientId,

            clientName: agreement.clientName || "",

            clientEntityName: agreement.clientEntityName || "",

            clientEmail: agreement.clientEmail || "",

            clientPhone: agreement.clientPhone || "",

            clientAddress: agreement.clientAddress || "",

            brokerName: agreement.brokerName || "",

            brokerCompany: agreement.brokerCompany || "",

            brokerEmail: agreement.brokerEmail || "",

            brokerPhone: agreement.brokerPhone || "",

            brokerAddress: agreement.brokerAddress || "",

            brokerState: agreement.brokerState || "",

            brokerCounty: agreement.brokerCounty || "",

            subjectAddress: agreement.subjectAddress || "",

            brokerPoints: agreement.brokerPoints || "",

            upfrontFee: agreement.upfrontFee || "",

            exclusivityMonths: agreement.exclusivityMonths || 0,

            agreementHtml: agreement.agreementHtml || "",

            clientSignature: agreement.clientSignature || null,

            agreementFile: agreement.agreementFile || null,

            signedAt: agreement.signedAt,

            createdAt: agreement.createdAt,

            updatedAt: agreement.updatedAt,

            application: {
              id: agreement.loanApplication?.id,

              applicationNumber:
                agreement.loanApplication?.applicationNumber || "",

              status: agreement.loanApplication?.status || "",

              amountRequested: agreement.loanApplication?.amountRequested || 0,

              purpose: agreement.loanApplication?.purpose || "",

              client: agreement.loanApplication?.client || null,
            },
          },
        });
      } catch (err) {
        req.log.error(err);

        return reply.code(500).send({
          ok: false,

          message: "Failed to fetch Fee Agreement",
        });
      }
      y;
    },
  );
};
