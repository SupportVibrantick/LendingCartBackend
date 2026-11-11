// routes/admin/lenders/hardDelete.js

const { adminLogs } = require("../../../services/logger/contextLogger");

/**
 * DEV ONLY - Permanent Hard Delete
 */
async function hardDeleteLenderRoutes(fastify) {
  fastify.delete(
    "/:lenderOrgId/hard",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "⚠️ HARD DELETE lender (DEV ONLY)",
        params: {
          type: "object",
          required: ["lenderOrgId"],
          properties: {
            lenderOrgId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const { lenderOrgId } = request.params;

      try {
        const lender = await prisma.organization.findFirst({
          where: {
            id: lenderOrgId,
            type: "LENDER",
          },
        });

        if (!lender) {
          return reply.status(404).send({
            success: false,
            message: "Lender not found.",
          });
        }

        await prisma.$transaction(async (tx) => {
          const appLenders = await tx.applicationLender.findMany({
            where: { lenderOrgId },
            select: { id: true },
          });
          const appLenderIds = appLenders.map((a) => a.id);

          if (appLenderIds.length) {
            // Break circular FK: currentLenderLoiVersionId → LenderLoiVersion
            await tx.applicationLender.updateMany({
              where: { id: { in: appLenderIds } },
              data: { currentLenderLoiVersionId: null },
            });

            // Unlink funded deals pointing at these application-lender rows
            await tx.loanApplication.updateMany({
              where: { fundedApplicationLenderId: { in: appLenderIds } },
              data: { fundedApplicationLenderId: null },
            });

            await tx.lenderCondition.deleteMany({
              where: {
                lenderReview: { applicationLenderId: { in: appLenderIds } },
              },
            });
            await tx.lenderReview.deleteMany({
              where: { applicationLenderId: { in: appLenderIds } },
            });
            await tx.lenderDocumentRequest.deleteMany({
              where: { applicationLenderId: { in: appLenderIds } },
            });
            await tx.applicationDocumentSubmission.deleteMany({
              where: { applicationLenderId: { in: appLenderIds } },
            });
            await tx.documentReminderSchedule.deleteMany({
              where: { applicationLenderId: { in: appLenderIds } },
            });
            await tx.brokerLoiVersion.updateMany({
              where: { sourceApplicationLenderId: { in: appLenderIds } },
              data: {
                sourceApplicationLenderId: null,
                sourceLenderLoiVersionId: null,
              },
            });
            await tx.lenderLoiVersion.deleteMany({
              where: { applicationLenderId: { in: appLenderIds } },
            });
            const appConversations = await tx.conversation.findMany({
              where: { applicationLenderId: { in: appLenderIds } },
              select: { id: true },
            });
            const appConversationIds = appConversations.map((c) => c.id);
            if (appConversationIds.length) {
              await tx.message.deleteMany({
                where: { conversationId: { in: appConversationIds } },
              });
              await tx.conversationParticipant.deleteMany({
                where: { conversationId: { in: appConversationIds } },
              });
              await tx.conversation.deleteMany({
                where: { id: { in: appConversationIds } },
              });
            }

            await tx.applicationDocumentRequirement.updateMany({
              where: { requestApplicationLenderId: { in: appLenderIds } },
              data: { requestApplicationLenderId: null },
            });
            await tx.applicationLender.deleteMany({
              where: { id: { in: appLenderIds } },
            });
          }

          await tx.lenderDocumentRequirement.deleteMany({
            where: { lenderProduct: { lenderOrgId } },
          });
          await tx.eligibilityRule.deleteMany({
            where: { ruleSet: { lenderProduct: { lenderOrgId } } },
          });
          await tx.eligibilityRuleSet.deleteMany({
            where: { lenderProduct: { lenderOrgId } },
          });
          await tx.lenderProduct.deleteMany({ where: { lenderOrgId } });

          const accessRows = await tx.brokerLenderAccess.findMany({
            where: { lenderOrgId },
            select: { id: true },
          });
          const accessIds = accessRows.map((r) => r.id);
          if (accessIds.length) {
            const accessConversations = await tx.conversation.findMany({
              where: { brokerLenderAccessId: { in: accessIds } },
              select: { id: true },
            });
            const accessConversationIds = accessConversations.map((c) => c.id);
            if (accessConversationIds.length) {
              await tx.message.deleteMany({
                where: { conversationId: { in: accessConversationIds } },
              });
              await tx.conversationParticipant.deleteMany({
                where: { conversationId: { in: accessConversationIds } },
              });
              await tx.conversation.deleteMany({
                where: { id: { in: accessConversationIds } },
              });
            }
          }
          await tx.brokerLenderAccess.deleteMany({ where: { lenderOrgId } });
          await tx.brokerLenderInvite.deleteMany({ where: { lenderOrgId } });

          await tx.escrowTitleCompany.deleteMany({
            where: { organizationId: lenderOrgId },
          });
          await tx.lenderBrandingSetting.deleteMany({
            where: { lenderOrgId },
          });
          await tx.lenderLoiTemplate.deleteMany({ where: { lenderOrgId } });
          await tx.adminLenderInvite.updateMany({
            where: { lenderOrgId },
            data: { lenderOrgId: null },
          });

          const formDefs = await tx.signFormDefinition.findMany({
            where: { organizationId: lenderOrgId },
            select: { id: true },
          });
          const formDefIds = formDefs.map((d) => d.id);
          if (formDefIds.length) {
            const formVersions = await tx.signFormVersion.findMany({
              where: { formDefinitionId: { in: formDefIds } },
              select: { id: true },
            });
            const formVersionIds = formVersions.map((v) => v.id);
            if (formVersionIds.length) {
              await tx.applicationDocumentRequirement.updateMany({
                where: { activeFormVersionId: { in: formVersionIds } },
                data: { activeFormVersionId: null },
              });
              const submissions = await tx.signFormSubmission.findMany({
                where: { formVersionId: { in: formVersionIds } },
                select: { id: true },
              });
              const submissionIds = submissions.map((s) => s.id);
              if (submissionIds.length) {
                await tx.signFormSubmissionValue.deleteMany({
                  where: { submissionId: { in: submissionIds } },
                });
                await tx.signFormSubmission.deleteMany({
                  where: { id: { in: submissionIds } },
                });
              }
            }
            await tx.signFormDefinition.deleteMany({
              where: { id: { in: formDefIds } },
            });
          }
          await tx.signFormLibraryTemplate.deleteMany({
            where: { organizationId: lenderOrgId },
          });

          const orgUsers = await tx.userAccount.findMany({
            where: { organizationId: lenderOrgId },
            select: { id: true },
          });
          const orgUserIds = orgUsers.map((u) => u.id);
          if (orgUserIds.length) {
            // Break optional user FKs that default to RESTRICT
            await tx.conversation.updateMany({
              where: { createdByUserId: { in: orgUserIds } },
              data: { createdByUserId: null },
            });
            await tx.auditLog.deleteMany({
              where: { actorUserId: { in: orgUserIds } },
            });
            await tx.signFormVersion.updateMany({
              where: { publishedByUserId: { in: orgUserIds } },
              data: { publishedByUserId: null },
            });
            await tx.signFormSubmissionValue.updateMany({
              where: { filledByUserId: { in: orgUserIds } },
              data: { filledByUserId: null },
            });
            await tx.signFormLibraryTemplate.updateMany({
              where: { createdByUserId: { in: orgUserIds } },
              data: { createdByUserId: null },
            });
            await tx.documentReminderSchedule.updateMany({
              where: { createdByUserId: { in: orgUserIds } },
              data: { createdByUserId: null },
            });
            await tx.contact.updateMany({
              where: { createdById: { in: orgUserIds } },
              data: { createdById: null },
            });
            await tx.escrowInstruction.updateMany({
              where: { createdByUserId: { in: orgUserIds } },
              data: { createdByUserId: null },
            });
          }

          await tx.userPermission.deleteMany({
            where: { user: { organizationId: lenderOrgId } },
          });
          await tx.userRole.deleteMany({
            where: { user: { organizationId: lenderOrgId } },
          });
          await tx.userAccount.deleteMany({
            where: { organizationId: lenderOrgId },
          });
          await tx.lenderProfile.deleteMany({ where: { lenderOrgId } });
          await tx.auditLog.deleteMany({ where: { actorOrgId: lenderOrgId } });

          await tx.organization.delete({ where: { id: lenderOrgId } });
        });

        adminLogs.warn("LENDER HARD DELETED (DEV)", { lenderOrgId });

        return reply.send({
          success: true,
          message: "Lender permanently deleted (DEV ONLY).",
        });
      } catch (error) {
        adminLogs.error("Hard delete failed", error);

        return reply.status(500).send({
          success: false,
          message: "Hard delete failed.",
          error: error.message,
        });
      }
    }
  );
}

module.exports = hardDeleteLenderRoutes;