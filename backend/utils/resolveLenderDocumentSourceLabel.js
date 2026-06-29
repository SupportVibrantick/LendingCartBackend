const {
  resolveCoBrokerDocumentSourceName,
} = require("./resolveCoBrokerDocumentSourceName");

function formatUserName(user) {
  if (!user) return null;

  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || null;
}

function resolveLenderDocumentSourceLabel(reqDoc, context) {
  const {
    brokerOrgName,
    brokerUserName,
    lenderName,
    uploads = [],
    assignmentNamesBySubBrokerId,
  } = context;

  if (reqDoc.source === "BROKER_ADDED") {
    return brokerOrgName || brokerUserName || "Broker";
  }

  if (reqDoc.source === "SUB_BROKER_ADDED") {
    return (
      resolveCoBrokerDocumentSourceName(
        { ...reqDoc, uploads },
        {
          assignmentNamesBySubBrokerId,
          fallbackName: "Co-Broker",
        },
      ) || "Co-Broker"
    );
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
