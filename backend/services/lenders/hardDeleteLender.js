/**
 * Permanently wipe a lender organization and related rows.
 * Used by admin hard-delete route and the 30-day deleted-lender purge cron.
 *
 * @param {import("@prisma/client").PrismaClient | import("@prisma/client").Prisma.TransactionClient} prisma
 * @param {string} lenderOrgId
 */
async function hardDeleteLenderOrg(prisma, lenderOrgId) {
  const lender = await prisma.organization.findFirst({
    where: {
      id: lenderOrgId,
      type: "LENDER",
    },
    select: { id: true, name: true, isDeleted: true, deletedAt: true },
  });

  if (!lender) {
    const err = new Error("Lender not found.");
    err.statusCode = 404;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    const appLenders = await tx.applicationLender.findMany({
      where: { lenderOrgId },
      select: { id: true },
    });
    const appLenderIds = appLenders.map((a) => a.id);

    if (appLenderIds.length) {
      await tx.applicationLender.updateMany({
        where: { id: { in: appLenderIds } },
        data: { currentLenderLoiVersionId: null },
      });

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

  return lender;
}

module.exports = {
  hardDeleteLenderOrg,
};
