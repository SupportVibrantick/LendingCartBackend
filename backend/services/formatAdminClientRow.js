const {
  resolveClientDisplayNameFromData,
  resolveClientEntityLabelFromData,
  resolveClientEntityTypeFromData,
  resolveClientIndustryFromData,
  resolveClientPrimaryContactFromData,
} = require("./resolveClientDisplayName");

function collectClientSubmissions(row) {
  return (row.loanApplications || []).flatMap((app) => app.submissions || []);
}

function formatAdminClientRow(row) {
  const submissions = collectClientSubmissions(row);
  const clientData = {
    legalName: row.legalName,
    entityType: row.entityType,
    industry: row.industry,
    contacts: row.contacts,
  };

  return {
    id: row.id,
    legalName: row.legalName,
    displayName: resolveClientDisplayNameFromData(clientData, submissions),
    entityLabel: resolveClientEntityLabelFromData(clientData, submissions),
    entityType: resolveClientEntityTypeFromData(clientData, submissions),
    industry: resolveClientIndustryFromData(row, submissions),
    isActive: row.isActive,
    createdAt: row.createdAt,
    brokerOrgId: row.primaryBrokerOrgId,
    brokerName: row.primaryBroker?.name || null,
    primaryContact: resolveClientPrimaryContactFromData(clientData, submissions),
    applicationsCount: row._count?.loanApplications ?? 0,
    portalUsersCount: row._count?.portalUsers ?? 0,
  };
}

module.exports = { formatAdminClientRow };
