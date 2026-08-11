/**
 * Validate and normalize a `requestedDocumentTypes` payload coming from any
 * loan-application submit endpoint (broker, sub-broker, loan-officer) or the
 * edit endpoint.
 *
 * Expected shape: `{ labels: string[], typeIds: string[] }`. Anything malformed
 * is dropped — the function returns either a sanitized object or null (when
 * the input is empty, missing, or invalid).
 *
 * Used by:
 *   - broker/applications/brokerSubmitApplication.js
 *   - subBroker/applications/submit.js (mirror)
 *   - loanOfficer/applications/submit.js (mirror)
 *   - broker/applications/editSubmittedApplication.js
 */
function sanitizeRequestedDocumentTypes(input) {
  if (!input || typeof input !== "object") return null;

  const labels = Array.isArray(input.labels)
    ? input.labels
        .filter((label) => typeof label === "string" && label.trim().length > 0)
        .map((label) => label.trim())
    : [];

  const typeIds = Array.isArray(input.typeIds)
    ? input.typeIds.filter((id) => typeof id === "string" && isUuid(id))
    : [];

  if (labels.length === 0 && typeIds.length === 0) return null;

  return { labels, typeIds };
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === "string" && UUID_REGEX.test(value);
}

module.exports = {
  sanitizeRequestedDocumentTypes,
};