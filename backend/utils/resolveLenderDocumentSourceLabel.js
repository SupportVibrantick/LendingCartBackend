function formatUserName(user) {
  if (!user) return null;

  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || null;
}

function resolveLenderDocumentSourceLabel(reqDoc, context) {
  const { brokerOrgName, brokerUserName, lenderName, uploads = [] } = context;

  if (reqDoc.source === "BROKER_ADDED") {
    return brokerOrgName || brokerUserName || "Broker";
  }

  if (reqDoc.source === "SUB_BROKER_ADDED") {
    for (const upload of uploads) {
      const uploaderName = formatUserName(upload.uploadedByUser);
      if (uploaderName) return uploaderName;
    }

    return "Sub Broker";
  }

  if (reqDoc.source === "LENDER_ADDED") {
    const name = lenderName || "Lender";
    return `Me · ${name}`;
  }

  return reqDoc.source || "-";
}

function matchesLenderDocumentSourceFilter(doc, sourceFilter) {
  if (!sourceFilter || sourceFilter === "all") return true;

  if (sourceFilter === "mine") {
    return doc.source === "LENDER_ADDED";
  }

  if (sourceFilter === "broker") {
    return doc.source === "BROKER_ADDED" || doc.source === "SUB_BROKER_ADDED";
  }

  return true;
}

module.exports = {
  formatUserName,
  resolveLenderDocumentSourceLabel,
  matchesLenderDocumentSourceFilter,
};
