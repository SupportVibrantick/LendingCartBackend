const {
  fetchPendingItems,
  upsertDocumentReminder,
  serializeReminder,
  immediateNextRunAt,
  processSingleReminder,
  REMINDER_TYPE_LABELS,
  fetchPendingItemsForReminders,
  normalizeSelectedRequirementIds,
} = require("../../../services/documents/documentReminderService");
const { requireLoOfficerPermission } = require("../../../services/broker/loanOfficerAccess");

function getUserRoles(user) {
  return Array.isArray(user?.roles) ? user.roles : [];
}

/** Broker admin / LO / co-broker staff on a broker org (JWT may omit orgType). */
function isBrokerOrgStaff(user) {
  if (!user?.organizationId) return false;
  if (user.orgType === "BROKER") return true;
  const roles = getUserRoles(user);
  return (
    roles.includes("BROKER_ADMIN") ||
    roles.includes("BROKER_OFFICER") ||
    roles.includes("SUB_BROKER")
  );
}

function assertBrokerStaff(req, reply) {
  if (!req.user || !isBrokerOrgStaff(req.user)) {
    reply.code(403).send({ success: false, message: "Broker access only" });
    return false;
  }
  return true;
}

async function assertSubBrokerLoanAccess(prisma, userId, loanId) {
  if (!userId || !loanId) return false;
  const assignment = await prisma.subBrokerApplication.findFirst({
    where: { loanApplicationId: loanId, subBrokerId: userId },
    select: { id: true },
  });
  return Boolean(assignment);
}

async function assertDocumentReminderAccess(req, reply, fastify, loan) {
  const roles = getUserRoles(req.user);
  const userId = req.user?.id || req.user?.userId;
  const loanId = loan?.id || loan?.loanApplicationId;

  if (roles.includes("SUB_BROKER")) {
    const allowed = await assertSubBrokerLoanAccess(
      fastify.prisma,
      userId,
      loanId,
    );
    if (!allowed) {
      reply.code(403).send({
        success: false,
        message: "Access denied for this loan",
      });
      return false;
    }
    return true;
  }

  if (!roles.includes("BROKER_OFFICER")) {
    return true;
  }

  await requireLoOfficerPermission(req, reply, fastify, "SEND_EMAILS");
  if (reply.sent) return false;

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
function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function buildReminderListWhere({
  loanId,
  brokerOrgId,
  statusFilter,
  recipientType,
  search,
}) {
  const where = {
    loanApplicationId: loanId,
    brokerOrgId,
  };

  if (statusFilter === "ACTIVE") {
    where.status = "ACTIVE";
  } else if (statusFilter === "PAUSED") {
    where.status = "PAUSED";
  } else if (statusFilter === "DONE") {
    where.status = { in: ["COMPLETED", "STOPPED"] };
  }

  if (recipientType === "CLIENT" || recipientType === "LENDER") {
    where.recipientType = recipientType;
  }

  const q = String(search || "").trim();
  if (q) {
    const upper = q.toUpperCase();
    const matchingTypes = Object.entries(REMINDER_TYPE_LABELS)
      .filter(
        ([key, label]) =>
          key.toUpperCase().includes(upper) ||
          String(label).toUpperCase().includes(upper),
      )
      .map(([key]) => key);

    const or = [
      { customMessage: { contains: q, mode: "insensitive" } },
      {
        applicationLender: {
          lender: { name: { contains: q, mode: "insensitive" } },
        },
      },
    ];

    if (["ACTIVE", "PAUSED", "COMPLETED", "STOPPED"].includes(upper)) {
      or.push({ status: upper });
    }

    if (upper === "CLIENT" || upper === "LENDER") {
      or.push({ recipientType: upper });
    }

    if (matchingTypes.length) {
      or.push({ reminderType: { in: matchingTypes } });
    }

    where.AND = [{ OR: or }];
  }

  return where;
}

module.exports = async function documentRemindersRoutes(fastify) {
  fastify.get(
    "/:loanId/document-reminders",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "List document email reminders for a loan application",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
            search: { type: "string" },
            status: {
              type: "string",
              enum: ["ALL", "ACTIVE", "PAUSED", "DONE"],
            },
            recipientType: {
              type: "string",
              enum: ["ALL", "CLIENT", "LENDER"],
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        if (!assertBrokerStaff(req, reply)) return;

        const brokerOrgId = req.user.organizationId;
        const { loanId } = req.params;
        const page = parsePositiveInt(req.query?.page, 1);
        const limit = Math.min(parsePositiveInt(req.query?.limit, 10), 100);
        const search = String(req.query?.search || "").trim();
        const statusFilter = String(req.query?.status || "ALL").toUpperCase();
        const recipientFilter = String(
          req.query?.recipientType || "ALL",
        ).toUpperCase();

        const loan = await fastify.prisma.loanApplication.findFirst({
          where: { id: loanId, brokerOrgId },
          select: {
            id: true,
            applicationNumber: true,
            brokerUserId: true,
            client: {
              select: {
                contacts: {
                  select: { email: true, isPrimary: true },
                  orderBy: { isPrimary: "desc" },
                  take: 5,
                },
              },
            },
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

        if (!(await assertDocumentReminderAccess(req, reply, fastify, loan))) {
          return;
        }

        const baseWhere = {
          loanApplicationId: loanId,
          brokerOrgId,
        };

        const listWhere = buildReminderListWhere({
          loanId,
          brokerOrgId,
          statusFilter,
          recipientType: recipientFilter,
          search,
        });

        const [total, reminders, statusGroups, scheduleIndex] =
          await Promise.all([
            fastify.prisma.documentReminderSchedule.count({ where: listWhere }),
            fastify.prisma.documentReminderSchedule.findMany({
              where: listWhere,
              orderBy: { createdAt: "desc" },
              skip: (page - 1) * limit,
              take: limit,
            }),
            fastify.prisma.documentReminderSchedule.groupBy({
              by: ["status"],
              where: baseWhere,
              _count: { id: true },
            }),
            fastify.prisma.documentReminderSchedule.findMany({
              where: baseWhere,
              select: {
                id: true,
                recipientType: true,
                reminderType: true,
                applicationLenderId: true,
                status: true,
                selectedRequirementIds: true,
              },
              orderBy: { createdAt: "desc" },
            }),
          ]);

        const pendingCountsMap = await fetchPendingItemsForReminders(
          fastify.prisma,
          loanId,
          reminders,
        );

        const countsMap = {};
        pendingCountsMap.forEach((res) => {
          countsMap[res.reminderId] = res.items.length;
        });

        const primaryContact =
          loan.client?.contacts?.find((c) => c.isPrimary && c.email) ||
          loan.client?.contacts?.find((c) => c.email) ||
          null;
        const clientEmail = primaryContact?.email || null;

        const lenderEmailByAppLenderId = {};
        for (const al of loan.applicationLenders || []) {
          lenderEmailByAppLenderId[al.id] = al.lender?.email || null;
        }

        const enriched = reminders.map((reminder) => {
          let recipientEmail = null;
          let recipientLabel = null;
          if (reminder.recipientType === "CLIENT") {
            recipientEmail = clientEmail;
            recipientLabel = "Client";
          } else if (
            reminder.recipientType === "LENDER" &&
            reminder.applicationLenderId
          ) {
            const lender = (loan.applicationLenders || []).find(
              (al) => al.id === reminder.applicationLenderId,
            );
            recipientEmail =
              lenderEmailByAppLenderId[reminder.applicationLenderId] || null;
            recipientLabel = lender?.lender?.name || "Lender";
          }

          return serializeReminder(reminder, countsMap[reminder.id] || 0, {
            recipientEmail,
            recipientLabel,
          });
        });

        const [pendingUploads, pendingSignatures] = await Promise.all([
          fetchPendingItems(fastify.prisma, {
            loanApplicationId: loanId,
            reminderType: "PENDING_UPLOAD",
            applicationLenderId: null,
          }),
          fetchPendingItems(fastify.prisma, {
            loanApplicationId: loanId,
            reminderType: "SIGNATURE_REQUIRED",
            applicationLenderId: null,
          }),
        ]);

        const mapPreviewItems = (items) =>
          (items || []).slice(0, 50).map((item) => ({
            id: item.id,
            name: item.name,
            status: item.status,
            uploadedCount:
              typeof item.uploadedCount === "number" ? item.uploadedCount : null,
            maxFiles: typeof item.maxFiles === "number" ? item.maxFiles : null,
            remainingSlots:
              typeof item.remainingSlots === "number"
                ? item.remainingSlots
                : null,
            filledFields:
              typeof item.filledFields === "number" ? item.filledFields : null,
            totalFields:
              typeof item.totalFields === "number" ? item.totalFields : null,
          }));

        const statusCounts = {
          all: 0,
          active: 0,
          paused: 0,
          done: 0,
        };
        for (const row of statusGroups) {
          const count = row._count?.id || 0;
          statusCounts.all += count;
          if (row.status === "ACTIVE") statusCounts.active += count;
          else if (row.status === "PAUSED") statusCounts.paused += count;
          else if (row.status === "COMPLETED" || row.status === "STOPPED") {
            statusCounts.done += count;
          }
        }

        const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

        return reply.send({
          success: true,
          data: {
            applicationNumber: loan.applicationNumber,
            applicationId: loan.id,
            clientEmail: primaryContact?.email || null,
            lenders: loan.applicationLenders.map((al) => ({
              applicationLenderId: al.id,
              lenderOrgId: al.lenderOrgId,
              lenderName: al.lender?.name || "Lender",
              lenderEmail: al.lender?.email || null,
            })),
            reminderTypeLabels: REMINDER_TYPE_LABELS,
            pendingPreview: {
              PENDING_UPLOAD: {
                count: pendingUploads.length,
                items: mapPreviewItems(pendingUploads),
              },
              SIGNATURE_REQUIRED: {
                count: pendingSignatures.length,
                items: mapPreviewItems(pendingSignatures),
              },
            },
            statusCounts,
            scheduleIndex: scheduleIndex.map((row) => ({
              id: row.id,
              recipientType: row.recipientType,
              reminderType: row.reminderType,
              applicationLenderId: row.applicationLenderId,
              status: row.status,
              selectedRequirementIds: normalizeSelectedRequirementIds(
                row.selectedRequirementIds,
              ),
            })),
            reminders: enriched,
          },
          pagination: {
            page,
            limit,
            total,
            totalPages,
            search,
            status: statusFilter,
            recipientType: recipientFilter,
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
        if (!assertBrokerStaff(req, reply)) return;

        const brokerOrgId = req.user.organizationId;
        const { loanId } = req.params;
        const {
          recipientType,
          reminderType,
          applicationLenderId,
          intervalValue = 1,
          intervalUnit = "DAYS",
          customMessage,
          selectedRequirementIds,
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

        if (!(await assertDocumentReminderAccess(req, reply, fastify, loan))) {
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

        if (
          recipientType === "CLIENT" &&
          Array.isArray(selectedRequirementIds) &&
          selectedRequirementIds.length === 0
        ) {
          return reply.code(400).send({
            success: false,
            message: "Select at least one document to remind about",
          });
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
          selectedRequirementIds:
            recipientType === "CLIENT" ? selectedRequirementIds : null,
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
        if (!assertBrokerStaff(req, reply)) return;

        const brokerOrgId = req.user.organizationId;
        const { reminderId } = req.params;
        const { intervalValue, intervalUnit, customMessage, status } = req.body || {};

        const existing = await fastify.prisma.documentReminderSchedule.findFirst({
          where: { id: reminderId, brokerOrgId },
          include: {
            loanApplication: { select: { id: true, brokerUserId: true } },
          },
        });

        if (!existing) {
          return reply.code(404).send({
            success: false,
            message: "Reminder not found",
          });
        }

        if (
          !(await assertDocumentReminderAccess(
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
        if (!assertBrokerStaff(req, reply)) return;

        const existing = await fastify.prisma.documentReminderSchedule.findFirst({
          where: {
            id: req.params.reminderId,
            brokerOrgId: req.user.organizationId,
          },
          include: {
            loanApplication: { select: { id: true, brokerUserId: true } },
          },
        });

        if (!existing) {
          return reply.code(404).send({
            success: false,
            message: "Reminder not found",
          });
        }

        if (
          !(await assertDocumentReminderAccess(
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
        if (!assertBrokerStaff(req, reply)) return;

        const existing = await fastify.prisma.documentReminderSchedule.findFirst({
          where: {
            id: req.params.reminderId,
            brokerOrgId: req.user.organizationId,
          },
          include: {
            loanApplication: { select: { id: true, brokerUserId: true } },
          },
        });

        if (!existing) {
          return reply.code(404).send({
            success: false,
            message: "Reminder not found",
          });
        }

        if (
          !(await assertDocumentReminderAccess(
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
          { manual: true },
        );

        // API process usually has ENABLE_CRONS=false, so flush outbox here
        // so "Send now" actually delivers without waiting for the worker.
        let delivered = 0;
        if (result.action === "sent") {
          try {
            const { processEmailOutbox } = require("../../../services/email");
            delivered = await processEmailOutbox(fastify.prisma);
          } catch (flushError) {
            fastify.log.warn(
              { err: flushError },
              "Document reminder queued but outbox flush failed",
            );
          }
        }

        const { isEmailEnabled } = require("../../../config/env");
        const emailEnabled = isEmailEnabled();

        let message = "Reminder processed";
        if (result.action === "completed") {
          message = "No pending items — reminder marked complete";
        } else if (result.action === "sent") {
          if (!emailEnabled) {
            message = `Reminder recorded for ${result.recipientEmail}, but EMAIL_ENABLED=false so SMTP was skipped`;
          } else if (delivered > 0) {
            message = `Reminder email sent to ${result.recipientEmail}`;
          } else {
            message = `Reminder queued for ${result.recipientEmail}. Run worker (npm run worker:dev) if mail does not arrive`;
          }
        }

        return reply.send({
          success: true,
          message,
          data: {
            ...result,
            delivered,
            emailEnabled,
          },
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
