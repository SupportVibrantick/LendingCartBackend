export function isPersonNameQuery(value: string) {
  const tokens = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 1) return false;
  if (/@|\d/.test(value)) return false;
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

export function filterRowsByBorrowerName<T extends { borrowerName?: string }>(
  rows: T[],
  search: string,
) {
  if (!isPersonNameQuery(search)) return rows;
  return rows.filter((row) =>
    borrowerNameMatchesSearch(row.borrowerName, search),
  );
}
