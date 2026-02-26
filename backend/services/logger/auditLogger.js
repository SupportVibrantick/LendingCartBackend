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
    await prisma.auditLog.create({
      data: {
        actorUserId: req.user?.id ?? null,
        actorOrgId: req.user?.organizationId ?? null,
        dashboard,
        category,
        entityType,
        entityId,
        action,
        oldValueJson: oldValue ? JSON.stringify(oldValue) : null,
        newValueJson: newValue ? JSON.stringify(newValue) : null,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
};