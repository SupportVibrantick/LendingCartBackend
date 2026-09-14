const { sanitizeAuditValue, truncateJsonString } = require("./sanitizeAuditValue");

module.exports.logAudit = async ({
  prisma,
  req,
  dashboard,
  category,
  entityType,
  entityId,
  action,
  oldValue = null,
  newValue = null,
}) => {
  try {
    // Do not block the request path on audit persistence.
    setImmediate(() => {
      prisma.auditLog
        .create({
          data: {
            actorUserId: req.user?.id ?? null,
            actorOrgId: req.user?.organizationId ?? null,
            dashboard,
            category,
            entityType,
            entityId,
            action,
            oldValueJson: oldValue
              ? truncateJsonString(JSON.stringify(sanitizeAuditValue(oldValue)))
              : null,
            newValueJson: newValue
              ? truncateJsonString(JSON.stringify(sanitizeAuditValue(newValue)))
              : null,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        })
        .catch((err) => {
          console.error("Audit log failed:", err.message);
        });
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
};
