/**
 * Utility to parse pagination parameters from request query.
 * Enforces a hard cap on the limit to prevent database exhaustion.
 *
 * @param {any} query - The request query object (req.query)
 * @param {number} defaultLimit - Default number of items per page (default: 20)
 * @param {number} maxLimit - Hard cap on the number of items per page (default: 100)
 * @returns {Object} { skip, take, page, limit }
 */
function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit || String(defaultLimit), 10)));
  const skip = (page - 1) * limit;

  return {
    skip,
    take: limit,
    page,
    limit,
  };
}

module.exports = { parsePagination };
