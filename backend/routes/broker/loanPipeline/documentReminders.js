const {
  fetchPendingItems,
  upsertDocumentReminder,
  serializeReminder,
  immediateNextRunAt,
  processSingleReminder,
  REMINDER_TYPE_LABELS,
} = require("../../../services/documents/documentReminderService");
const { requireLoOfficerPermission } = require("../../../services/broker/loanOfficerAccess");

async function assertLoDocumentReminderAccess(req, reply, fastify, loan) {
  if (!req.user?.roles?.includes("BROKER_OFFICER")) {
    return true;
  }

  await requireLoOfficerPermission(req, reply, fastify, "SEND_EMAILS");
  if (reply.sent) return false;

  const userId = req.user.id || req.user.userId;
  if (loan?.brokerUserId !== userId) {
    reply.code(403).send({
      success: false,
      message: "Access denied - not assigned to you",
    });
    return false;
  }

  return true;
}

const VALID_INTERVAL_UNITS = ["MINUTES", "HOURS", "DAYS"];
const VALID_RECIPIENT_TYPES = ["CLIENT", "LENDER"];
const VALID_REMINDER_TYPES = [
  "PENDING_UPLOAD",
  "SIGNATURE_REQUIRED",
  "LENDER_REVIEW",
];
const VALID_STATUSES = ["ACTIVE", "PAUSED", "STOPPED"];

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function documentRemindersRoutes(fastify) {
  fastify.get(
    "/:loanId/document-reminders",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "List document email reminders for a loan application",
      },
    },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER" || !req.user.organizationId) {
          return reply.code(403).send({ success: false, message: "Broker access only" });
        }

        const brokerOrgId = req.user.organizationId;
        const { loanId } = req.params;

        const loan = await fastify.prisma.loanApplication.findFirst({
          where: { id: loanId, brokerOrgId },
          select: {
            id: true,
            applicationNumber: true,
            brokerUserId: true,
            applicationLenders: {
              include: {
                lender: { select: { id: true, name: true, email: true } },
              },
            },
          },
        });

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan application not found",
          });
        }

        if (!(await assertLoDocumentReminderAccess(req, reply, fastify, loan))) {
          return;
        }

        const reminders = await fastify.prisma.documentReminderSchedule.findMany({
          where: { loanApplicationId: loanId, brokerOrgId },
          orderBy: { createdAt: "desc" },
        });

        const enriched = await Promise.all(
          reminders.map(async (reminder) => {
            const pendingItems = await fetchPendingItems(fastify.prisma, reminder);
            return serializeReminder(reminder, pendingItems.length);
          }),
        );

        return reply.send({
          success: true,
          data: {
            applicationNumber: loan.applicationNumber,
            applicationId: loan.id,
            lenders: loan.applicationLenders.map((al) => ({
              applicationLenderId: al.id,
              lenderOrgId: al.lenderOrgId,
              lenderName: al.lender?.name || "Lender",
              lenderEmail: al.lender?.email || null,
            })),
            reminderTypeLabels: REMINDER_TYPE_LABELS,
            reminders: enriched,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to load document reminders",
        });
      }
    },
  );

  fastify.post(
    "/:loanId/document-reminders",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Create or update a document email reminder schedule",
      },
    },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER" || !req.user.organizationId) {
          return reply.code(403).send({ success: false, message: "Broker access only" });
        }

        const brokerOrgId = req.user.organizationId;
        const { loanId } = req.params;
        const {
          recipientType,
          reminderType,
          applicationLenderId,
          intervalValue = 1,
          intervalUnit = "DAYS",
          customMessage,
          status = "ACTIVE",
        } = req.body || {};

        if (!VALID_RECIPIENT_TYPES.includes(recipientType)) {
          return reply.code(400).send({
            success: false,
            message: "recipientType must be CLIENT or LENDER",
          });
        }

        if (!VALID_REMINDER_TYPES.includes(reminderType)) {
          return reply.code(400).send({
            success: false,
            message: "Invalid reminderType",
          });
        }

        if (!VALID_INTERVAL_UNITS.includes(intervalUnit)) {
          return reply.code(400).send({
            success: false,
            message: "intervalUnit must be MINUTES, HOURS, or DAYS",
          });
        }

        if (Number(intervalValue) < 1) {
          return reply.code(400).send({
            success: false,
            message: "intervalValue must be at least 1",
          });
        }

        if (recipientType === "LENDER") {
          if (!applicationLenderId) {
            return reply.code(400).send({
              success: false,
              message: "applicationLenderId is required for lender reminders",
            });
          }

          if (reminderType !== "LENDER_REVIEW") {
            return reply.code(400).send({
              success: false,
              message: "Lender reminders must use reminderType LENDER_REVIEW",
            });
          }
        } else if (reminderType === "LENDER_REVIEW") {
          return reply.code(400).send({
            success: false,
            message: "LENDER_REVIEW is only valid for lender recipients",
          });
        }

        const loan = await fastify.prisma.loanApplication.findFirst({
          where: { id: loanId, brokerOrgId },
          select: { id: true, applicationNumber: true, brokerUserId: true },
        });

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan application not found",
          });
        }

        if (!(await assertLoDocumentReminderAccess(req, reply, fastify, loan))) {
          return;
        }

        if (recipientType === "LENDER") {
          const appLender = await fastify.prisma.applicationLender.findFirst({
            where: {
              id: applicationLenderId,
              loanApplicationId: loanId,
            },
          });

          if (!appLender) {
            return reply.code(400).send({
              success: false,
              message: "Invalid lender for this application",
            });
          }
        }

        const reminder = await upsertDocumentReminder(fastify.prisma, {
          loanApplicationId: loanId,
          brokerOrgId,
          recipientType,
          reminderType,
          applicationLenderId,
          intervalValue: Number(intervalValue),
          intervalUnit,
          customMessage: customMessage || null,
          status: VALID_STATUSES.includes(status) ? status : "ACTIVE",
          createdByUserId: req.user.id,
        });

        const pendingItems = await fetchPendingItems(fastify.prisma, reminder);

        return reply.send({
          success: true,
          message: "Document reminder saved",
          data: serializeReminder(reminder, pendingItems.length),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to save document reminder",
        });
      }
    },
  );

  fastify.patch(
    "/document-reminders/:reminderId",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Update a document email reminder",
      },
    },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER" || !req.user.organizationId) {
          return reply.code(403).send({ success: false, message: "Broker access only" });
        }

        const brokerOrgId = req.user.organizationId;
        const { reminderId } = req.params;
        const { intervalValue, intervalUnit, customMessage, status } = req.body || {};

        const existing = await fastify.prisma.documentReminderSchedule.findFirst({
          where: { id: reminderId, brokerOrgId },
          include: {
            loanApplication: { select: { brokerUserId: true } },
          },
        });

        if (!existing) {
          return reply.code(404).send({
            success: false,
            message: "Reminder not found",
          });
        }

        if (
          !(await assertLoDocumentReminderAccess(
            req,
            reply,
            fastify,
            existing.loanApplication,
          ))
        ) {
          return;
        }

        const data = {};

        if (intervalValue !== undefined) {
          if (Number(intervalValue) < 1) {
            return reply.code(400).send({
              success: false,
              message: "intervalValue must be at least 1",
            });
          }
          data.intervalValue = Number(intervalValue);
        }

        if (intervalUnit !== undefined) {
          if (!VALID_INTERVAL_UNITS.includes(intervalUnit)) {
            return reply.code(400).send({
              success: false,
              message: "intervalUnit must be MINUTES, HOURS, or DAYS",
            });
          }
          data.intervalUnit = intervalUnit;
        }

        if (customMessage !== undefined) {
          data.customMessage = customMessage || null;
        }

        if (status !== undefined) {
          if (!VALID_STATUSES.includes(status)) {
            return reply.code(400).send({
              success: false,
              message: "Invalid status",
            });
          }
          data.status = status;

          if (status === "ACTIVE") {
            // Resume immediately on the next cron tick (do not wait a full interval).
            data.nextRunAt = immediateNextRunAt();
          } else if (status === "PAUSED") {
            data.nextRunAt = existing.nextRunAt;
          }
        }

        const reminder = await fastify.prisma.documentReminderSchedule.update({
          where: { id: reminderId },
          data,
        });

        const pendingItems = await fetchPendingItems(fastify.prisma, reminder);

        return reply.send({
          success: true,
          message: "Reminder updated",
          data: serializeReminder(reminder, pendingItems.length),
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to update reminder",
        });
      }
    },
  );

  fastify.delete(
    "/document-reminders/:reminderId",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Delete a document email reminder",
      },
    },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER" || !req.user.organizationId) {
          return reply.code(403).send({ success: false, message: "Broker access only" });
        }

        const existing = await fastify.prisma.documentReminderSchedule.findFirst({
          where: {
            id: req.params.reminderId,
            brokerOrgId: req.user.organizationId,
          },
          include: {
            loanApplication: { select: { brokerUserId: true } },
          },
        });

        if (!existing) {
          return reply.code(404).send({
            success: false,
            message: "Reminder not found",
          });
        }

        if (
          !(await assertLoDocumentReminderAccess(
            req,
            reply,
            fastify,
            existing.loanApplication,
          ))
        ) {
          return;
        }

        await fastify.prisma.documentReminderSchedule.delete({
          where: { id: existing.id },
        });

        return reply.send({
          success: true,
          message: "Reminder deleted",
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to delete reminder",
        });
      }
    },
  );

  fastify.post(
    "/document-reminders/:reminderId/send-now",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Send a document reminder email immediately",
      },
    },
    async (req, reply) => {
      try {
        if (!req.user || req.user.orgType !== "BROKER" || !req.user.organizationId) {
          return reply.code(403).send({ success: false, message: "Broker access only" });
        }

        const existing = await fastify.prisma.documentReminderSchedule.findFirst({
          where: {
            id: req.params.reminderId,
            brokerOrgId: req.user.organizationId,
          },
          include: {
            loanApplication: { select: { brokerUserId: true } },
          },
        });

        if (!existing) {
          return reply.code(404).send({
            success: false,
            message: "Reminder not found",
          });
        }

        if (
          !(await assertLoDocumentReminderAccess(
            req,
            reply,
            fastify,
            existing.loanApplication,
          ))
        ) {
          return;
        }

        const result = await processSingleReminder(
          fastify.prisma,
          fastify.io,
          existing,
        );

        return reply.send({
          success: true,
          message:
            result.action === "sent"
              ? "Reminder email sent"
              : result.action === "completed"
                ? "No pending items — reminder marked complete"
                : "Reminder processed",
          data: result,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to send reminder",
        });
      }
    },
  );
};
