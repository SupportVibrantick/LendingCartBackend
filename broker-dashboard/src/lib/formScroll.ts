/** Pick the first error key in visual form order (not Object.keys insertion order). */
export function getFirstErrorField(
  errors: Record<string, string | undefined | null>,
  order: string[],
): string | null {
  for (const key of order) {
    if (errors[key]) return key;
  }
  const fallback = Object.keys(errors).find((key) => Boolean(errors[key]));
  return fallback || null;
}

/** Scroll a modal/form body to the field wrapper marked with data-field. */
export function scrollToFormField(
  container: HTMLElement | null | undefined,
  fieldKey: string,
) {
  if (!container || !fieldKey) return;

  const el = container.querySelector(
    `[data-field="${CSS.escape(fieldKey)}"]`,
  ) as HTMLElement | null;
  if (!el) return;

  // Prefer container scroll so nested modal bodies don't jump the page behind.
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const targetTop =
    elRect.top -
    containerRect.top +
    container.scrollTop -
    container.clientHeight / 2 +
    elRect.height / 2;
  container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });

  const focusable = el.querySelector(
    "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])",
  ) as HTMLElement | null;
  window.setTimeout(() => {
    focusable?.focus?.({ preventScroll: true });
  }, 250);
}

export const LOAN_OFFICER_FORM_FIELD_ORDER = [
  "email",
  "confirmEmail",
  "firstName",
  "lastName",
  "company",
  "phone",
  "address",
  "accountType",
  "partyName",
  "partyAddress",
  "partyTel",
  "partyEmail",
  "bankName",
  "bankTel",
  "accountName",
  "accountNumber",
  "abaRoutingNumber",
  "password",
  "confirmPassword",
  "permissions",
] as const;

export const CO_BROKER_FORM_FIELD_ORDER = [
  "partnerType",
  "company",
  "firstName",
  "lastName",
  "email",
  "phone",
  "agentType",
  "accountType",
  "partyName",
  "partyAddress",
  "partyTel",
  "partyEmail",
  "bankName",
  "bankTel",
  "accountName",
  "accountNumber",
  "abaRoutingNumber",
  "contactFirstName",
  "contactLastName",
  "contactPhone",
  "contactEmail",
  "password",
  "confirmPassword",
] as const;
