function stringifySearchValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Filter mapped submission fields by free-text search (label, key, value, section).
 */
function filterSubmissionFieldsBySearch(fields = [], search = "") {
  const list = Array.isArray(fields) ? fields : [];
  const query = String(search || "").trim().toLowerCase();
  if (!query) {
    return {
      fields: list,
      total: list.length,
      matched: list.length,
      query: "",
    };
  }

  const filtered = list.filter((field) => {
    const label = String(field?.label || "").toLowerCase();
    const key = String(field?.fieldKey || "").toLowerCase();
    const section = String(field?.sectionName || "").toLowerCase();
    const value = stringifySearchValue(field?.value).toLowerCase();
    return (
      label.includes(query) ||
      key.includes(query) ||
      section.includes(query) ||
      value.includes(query)
    );
  });

  return {
    fields: filtered,
    total: list.length,
    matched: filtered.length,
    query: String(search || "").trim(),
  };
}

module.exports = {
  filterSubmissionFieldsBySearch,
  stringifySearchValue,
};
