module.exports = async function (fastify) {
  const { normalizeFeeAgreement } = require("../../../../services/feeAgreementEnrichment");
  fastify.get(
    "/:loanId/fee-agreement",
    {
      schema: {
        tags: ["Loan Pipeline → Fee Agreement"],
        summary: "Get Fee Agreement for a loan",
        params: {
          type: "object",
          required: ["loanId"],
          properties: {
            loanId: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const prisma = fastify.prisma;
        const { loanId } = req.params;

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
           FETCH AGREEMENT + EXTRA DATA
        =============================== */
        const agreement =
          await prisma.feeAgreement.findUnique({
            where: {
              loanApplicationId: loanId,
            },

            include: {
              loanApplication: {
                include: {
                  brokerOrg: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      phone: true,
                    },
                  },

                  brokerUser: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      profileImage: true,

                      roles: {
                        select: {
                          role: {
                            select: {
                              name: true,
                            },
                          },
                        },
                      },
                    },
                  },

                  client: {
                    include: {
                      contacts: {
                        where: {
                          isPrimary: true,
                        },
                        take: 1,
                      },
                    },
                  },

                  applicationLenders: {
                    include: {
                      lender: {
                        include: {
                          users: {
                            select: {
                              profileImage: true,
                            },
                            take: 1,
                          },
                        },
                      },

                      lenderProduct: true,

                      lenderReviews: {
                        include: {
                          reviewedByUser: true,
                          conditions: true,
                        },
                      },
                    },
                  },

                  subBrokerAssignments: {
                    include: {
                      subBroker: {
                        select: {
                          id: true,
                          firstName: true,
                          lastName: true,
                          email: true,
                          profileImage: true,
                        },
                      },
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
           LOAN OFFICER
        =============================== */
        const assignedLoanOfficer =
          agreement.loanApplication?.brokerUser &&
          agreement.loanApplication.brokerUser.roles?.some(
            (r) =>
              r.role?.name === "BROKER_OFFICER",
          )
            ? {
                id:
                  agreement.loanApplication
                    .brokerUser.id,

                name: `${agreement.loanApplication.brokerUser.firstName || ""} ${
                  agreement.loanApplication.brokerUser.lastName || ""
                }`.trim(),

                email:
                  agreement.loanApplication
                    .brokerUser.email || "",

                profileImage:
                  agreement.loanApplication
                    .brokerUser.profileImage ||
                  null,
              }
            : null;

        /* ===============================
           SUB BROKERS
        =============================== */
        const assignedSubBrokers =
          agreement.loanApplication?.subBrokerAssignments?.map(
            (item) => ({
              id: item.subBroker?.id,

              name: `${item.subBroker?.firstName || ""} ${
                item.subBroker?.lastName || ""
              }`.trim(),

              email:
                item.subBroker?.email || "",

              profileImage:
                item.subBroker?.profileImage ||
                null,
            }),
          ) || [];

        /* ===============================
           BORROWER NAME
        =============================== */
        const primaryContact =
          agreement.loanApplication?.client
            ?.contacts?.[0] || null;

        const borrowerName = primaryContact
          ? `${primaryContact.firstName ?? ""} ${
              primaryContact.lastName ?? ""
            }`.trim()
          : null;

        /* ===============================
           FINAL RESPONSE DATA
        =============================== */
        const responseData = normalizeFeeAgreement(
          {
            ...agreement,
            borrowerName,
            assignedLoanOfficer,
            assignedSubBrokers,
            lenders:
              agreement.loanApplication?.applicationLenders
                ?.filter((l) => l.sentAt)
                ?.map((l) => ({
                  applicationLenderId: l.id,
                  lenderOrgId: l.lenderOrgId,
                  lenderName: l.lender?.name ?? null,
                  profileImage: l.lender?.users?.[0]?.profileImage || null,
                  lenderStatus: l.status,
                  sentAt: l.sentAt,
                  lastUpdatedAt: l.lastUpdatedAt,
                  reviews: l.lenderReviews.map((r) => ({
                    reviewId: r.id,
                    reviewStatus: r.reviewStatus,
                    approvedAmount: r.approvedAmount,
                    interestRate: r.interestRate,
                    notes: r.notes,
                    reviewedAt: r.createdAt,
                    reviewedBy: r.reviewedByUser
                      ? {
                          userId: r.reviewedByUser.id,
                          name: `${r.reviewedByUser.firstName ?? ""} ${
                            r.reviewedByUser.lastName ?? ""
                          }`.trim(),
                          email: r.reviewedByUser.email,
                        }
                      : null,
                    conditions: r.conditions.map((c) => ({
                      conditionId: c.id,
                      description: c.description,
                      status: c.status,
                      satisfiedAt: c.satisfiedAt,
                    })),
                  })),
                })) || [],
          },
          agreement.loanApplication,
        );

        /* ===============================
           ROLE ACCESS
        =============================== */

        // PLATFORM ADMIN
        if (
          req.user.role === "PLATFORM_ADMIN"
        ) {
          return reply.send({
            ok: true,
            data: responseData,
          });
        }

        // BROKER ACCESS
        if (req.user.orgType === "BROKER") {
          return reply.send({
            ok: true,
            data: responseData,
          });
        }

        // CLIENT ACCESS
        if (req.user.role === "CLIENT_USER") {
          if (
            agreement.loanApplication
              ?.clientId !==
            req.user.clientId
          ) {
            return reply.code(403).send({
              ok: false,
              message: "Access denied",
            });
          }

          return reply.send({
            ok: true,
            data: responseData,
          });
        }

        // LOAN OFFICER ACCESS
        if (
          req.user.role === "BROKER_OFFICER"
        ) {
          if (
            agreement.loanApplication
              ?.brokerUser?.id !==
            req.user.id
          ) {
            return reply.code(403).send({
              ok: false,
              message: "Access denied",
            });
          }

          return reply.send({
            ok: true,
            data: responseData,
          });
        }

        // SUB BROKER ACCESS
        if (
          req.user.role === "SUB_BROKER"
        ) {
          const assigned =
            agreement.loanApplication?.subBrokerAssignments?.some(
              (item) =>
                item.subBrokerId ===
                req.user.id,
            );

          if (!assigned) {
            return reply.code(403).send({
              ok: false,
              message: "Access denied",
            });
          }

          return reply.send({
            ok: true,
            data: responseData,
          });
        }

        /* ===============================
           DEFAULT DENY
        =============================== */
        return reply.code(403).send({
          ok: false,
          message: "Forbidden",
        });
      } catch (err) {
        req.log.error(err);

        return reply.code(500).send({
          ok: false,
          message:
            "Failed to fetch Fee Agreement",
          error: err.message,
        });
      }
    },
  );
};