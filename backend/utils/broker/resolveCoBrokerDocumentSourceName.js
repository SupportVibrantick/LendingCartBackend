function formatUserName(user) {
  if (!user) return null;

  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || null;
}

function buildSubBrokerAssignmentNameMap(assignments = []) {
  const map = new Map();

  for (const assignment of assignments) {
    if (!assignment?.subBrokerId) continue;

    map.set(
      assignment.subBrokerId,
      formatUserName(assignment.subBroker) || "Co-Broker",
    );
  }

  return map;
}

function resolveCoBrokerDocumentSourceName(
  requirement,
  { assignmentNamesBySubBrokerId = new Map(), fallbackName = "Co-Broker" } = {},
) {
  if (!requirement || requirement.source !== "SUB_BROKER_ADDED") {
    return null;
  }

  const requestedByName = formatUserName(requirement.requestedBySubBroker);
  if (requestedByName) return requestedByName;

  if (requirement.requestedBySubBrokerId) {
    const mappedName = assignmentNamesBySubBrokerId.get(
      requirement.requestedBySubBrokerId,
    );
    if (mappedName) return mappedName;
  }

  for (const upload of requirement.uploads || []) {
    for (const submission of upload.subBrokerSubmissions || []) {
      const submitterName = formatUserName(submission.submittedBy);
      if (submitterName) return submitterName;
    }
  }

  for (const upload of requirement.uploads || []) {
    const uploaderId = upload.uploadedByUser?.id;
    if (uploaderId && assignmentNamesBySubBrokerId.has(uploaderId)) {
      const uploaderName = formatUserName(upload.uploadedByUser);
      if (uploaderName) return uploaderName;
    }
  }

  if (assignmentNamesBySubBrokerId.size === 1) {
    return [...assignmentNamesBySubBrokerId.values()][0];
  }

  return fallbackName;
}

module.exports = {
  formatUserName,
  buildSubBrokerAssignmentNameMap,
  resolveCoBrokerDocumentSourceName,
};
