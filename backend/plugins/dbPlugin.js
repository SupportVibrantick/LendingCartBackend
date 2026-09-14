const fp = require("fastify-plugin");
const prismaBase = require("../config/prisma");
const {
  sanitizeAuditValue,
  truncateJsonString,
} = require("../services/logger/sanitizeAuditValue");

module.exports = fp(async function dbPlugin(fastify) {
  const AUDITED_MODELS = new Set([
    "LoanApplication",
    "UserAccount",
    "Organization",
    "ApplicationLender",
    "Client",
    "LenderReview",
  ]);

  const prisma = prismaBase.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const actionsToLog = ["create", "update", "delete", "upsert"];

          // Skip AuditLog itself and non-write operations
          if (
            model === "AuditLog" ||
            !actionsToLog.includes(operation) ||
            !AUDITED_MODELS.has(model)
          ) {
            return query(args);
          }

          let oldValue = null;

          if (["update", "delete"].includes(operation)) {
            try {
              if (args?.where) {
                oldValue = await prisma[model].findUnique({
                  where: args.where,
                });
              }
            } catch {
              oldValue = null;
            }
          }

          const result = await query(args);

          // Fire-and-forget so primary writes are not blocked by audit I/O.
          setImmediate(() => {
            try {
              const auditData = {
                entityType: model,
                entityId: String(result?.id || oldValue?.id || "UNKNOWN"),
                action: operation.toUpperCase(),
                dashboard: "PLATFORM",
                category: "SYSTEM",
                oldValueJson: oldValue
                  ? truncateJsonString(
                      JSON.stringify(sanitizeAuditValue(oldValue)),
                    )
                  : null,
                newValueJson:
                  operation !== "delete" && result
                    ? truncateJsonString(
                        JSON.stringify(sanitizeAuditValue(result)),
                      )
                    : null,
              };

              prismaBase.auditLog
                .create({ data: auditData })
                .catch((err) => {
                  console.error("Audit log skipped:", err.message);
                });
            } catch (err) {
              console.error("Audit log skipped:", err.message);
            }
          });

          return result;
        },
      },
    },
  });

  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
