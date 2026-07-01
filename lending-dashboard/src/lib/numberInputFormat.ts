export function stripNumberFormatting(value: string): string {
  return value.replace(/,/g, "").trim();
}

export function sanitizeNumberInput(
  value: string,
  options?: { decimal?: boolean },
): string {
  const cleaned = stripNumberFormatting(value);
  if (!cleaned) return "";

  if (options?.decimal) {
    const match = cleaned.match(/^\d*\.?\d*/);
    return match ? match[0] : "";
  }

  return cleaned.replace(/\D/g, "");
}

export function formatNumberInputValue(
  value: string | number | null | undefined,
  options?: { decimal?: boolean },
): string {
  if (value === "" || value === null || value === undefined) return "";

  const raw = stripNumberFormatting(String(value));
  if (!raw) return "";

  if (options?.decimal) {
    if (raw === ".") return ".";

    const [intPart = "", decPart] = raw.split(".");
    const formattedInt =
      intPart === ""
        ? "0"
        : Number(intPart).toLocaleString("en-US");

    if (raw.endsWith(".") && decPart === undefined) {
      return `${formattedInt}.`;
    }

    if (decPart !== undefined) {
      const safeDec = decPart.replace(/\D/g, "");
      return `${formattedInt}.${safeDec}`;
    }

    return formattedInt;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}
