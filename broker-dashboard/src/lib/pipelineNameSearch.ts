export function isPlainTextQuery(value: string) {
  const tokens = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 1) return false;
  if (/@/.test(value)) return false;
  if (/\d/.test(value)) return false;
  return tokens.every((token) => /^[A-Za-z][A-Za-z.'’-]*$/.test(token));
}

export function borrowerNameMatchesSearch(
  name: string | undefined,
  search: string,
) {
  const haystack = String(name || "")
    .trim()
    .toLowerCase();
  if (!haystack || haystack === "n/a") return false;
  const needle = search.trim().toLowerCase();
  if (haystack.includes(needle)) return true;
  const tokens = needle.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => haystack.includes(token));
}

function rowSearchHaystack(row: Record<string, unknown>) {
  return [
    row.borrowerName,
    row.cityState,
    row.country,
    row.applicationNumber,
    row.loanType,
    row.company,
    row.entityType,
    row.brokerName,
  ]
    .filter((value) => value != null && String(value).trim() && String(value) !== "N/A")
    .join(" ")
    .toLowerCase();
}

export function rowMatchesPipelineSearch(
  row: Record<string, unknown>,
  search: string,
) {
  if (!isPlainTextQuery(search)) return true;
  const haystack = rowSearchHaystack(row);
  if (!haystack) return false;
  const needle = search.trim().toLowerCase();
  if (haystack.includes(needle)) return true;
  const tokens = needle.split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

export function filterRowsByBorrowerName<T extends { borrowerName?: string }>(
  rows: T[],
  search: string,
) {
  if (!isPlainTextQuery(search)) return rows;
  return rows.filter((row) =>
    rowMatchesPipelineSearch(row as Record<string, unknown>, search),
  );
}
