const fp = require("fastify-plugin");
const { PrismaClient } = require("@prisma/client");

module.exports = fp(async function dbPlugin(fastify) {

  const prisma = new PrismaClient().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {

          const actionsToLog = ["create", "update", "delete", "upsert"];

          // Skip logging AuditLog itself
          if (model === "AuditLog" || !actionsToLog.includes(operation)) {
            return query(args);
          }

          let oldValue = null;

          // Capture old value before update/delete
          if (["update", "delete"].includes(operation)) {
            try {
              oldValue = await prisma[model].findUnique({
                where: args.where,
              });
            } catch (e) {
              oldValue = null;
            }
          }

          const result = await query(args);

          try {
            await prisma.auditLog.create({
              data: {
                entityType: model,
                entityId: result?.id || oldValue?.id || "UNKNOWN",
                action: operation.toUpperCase(),
                oldValueJson: oldValue ? JSON.stringify(oldValue) : null,
                newValueJson:
                  operation !== "delete" && result
                    ? JSON.stringify(result)
                    : null,
              },
            });
          } catch (err) {
            console.error("Audit log failed:", err.message);
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