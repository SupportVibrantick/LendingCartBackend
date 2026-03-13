const fp = require("fastify-plugin");
const { PrismaClient } = require("@prisma/client");

module.exports = fp(async function dbPlugin(fastify) {

  const prisma = new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {

          const actionsToLog = ["create", "update", "delete", "upsert"];

          // Skip AuditLog itself and non-write operations
          if (model === "AuditLog" || !actionsToLog.includes(operation)) {
            return query(args);
          }

          let oldValue = null;

          /* ============================
             Capture old value
          ============================ */

          if (["update", "delete"].includes(operation)) {
            try {
              if (args?.where) {
                oldValue = await prisma[model].findUnique({
                  where: args.where,
                });
              }
            } catch (e) {
              oldValue = null;
            }
          }

          const result = await query(args);

          /* ============================
             Safe Audit Logging
          ============================ */

          try {

            // Skip if audit log requires fields we don't have
            const auditData = {
              entityType: model,
              entityId: result?.id || oldValue?.id || "UNKNOWN",
              action: operation.toUpperCase(),
              oldValueJson: oldValue ? JSON.stringify(oldValue) : null,
              newValueJson:
                operation !== "delete" && result
                  ? JSON.stringify(result)
                  : null,
            };

            // Only log if schema allows minimal fields
            if (prisma.auditLog) {
              await prisma.auditLog.create({
                data: auditData,
              });
            }

          } catch (err) {
            console.error("Audit log skipped:", err.message);
          }

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