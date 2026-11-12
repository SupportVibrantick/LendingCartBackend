import { useEffect, useRef } from "react";
import { formatUsDate } from "../../lib/usDateFormat";

export const APPLICATION_DRAFT_VERSION = 1 as const;

export type ApplicationDraftPayload = {
  currentStep: number;
  selectedProduct: string;
  selectedCategory: string;
  formData: Record<string, unknown>;
  dynamicFormData: Record<string, unknown>;
  creditAuthorizationConsent: boolean;
  feeAgreementDraft: Record<string, unknown> | null;
};

export type ApplicationDraft = ApplicationDraftPayload & {
  version: typeof APPLICATION_DRAFT_VERSION;
  savedAt: string;
};

export type ApplicationDraftKeyInput = {
  portal: string;
  publicEmbed?: boolean;
  brokerOrgId?: string | null;
  publicLinkRef?: string | null;
};

const USER_STORAGE_KEYS: Record<string, string> = {
  broker: "broker_user",
  loanOfficer: "loan_officer_user",
  loan_officer: "loan_officer_user",
  coBroker: "sub_broker_user",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readSessionUserId(portal: string): string {
  if (typeof sessionStorage === "undefined") return "local";
  const key = USER_STORAGE_KEYS[portal] || "broker_user";
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return "local";
    const user = JSON.parse(raw);
    const id = user?.id || user?.userId || user?.user?.id;
    return id ? String(id) : "local";
  } catch {
    return "local";
  }
}

export function getApplicationDraftKey(input: ApplicationDraftKeyInput): string {
  const portal = input.portal || "broker";
  if (input.publicEmbed) {
    const scope = input.publicLinkRef || input.brokerOrgId || "anon";
    return `lendingcart.applicationDraft.v1.public.${scope}`;
  }
  return `lendingcart.applicationDraft.v1.${portal}.${readSessionUserId(portal)}`;
}

function stripUnserializable(value: unknown): unknown {
  if (typeof File !== "undefined" && value instanceof File) return undefined;
  if (typeof Blob !== "undefined" && value instanceof Blob) return undefined;
  if (typeof value === "function") return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUnserializable(item))
      .filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      const cleaned = stripUnserializable(nested);
      if (cleaned !== undefined) next[key] = cleaned;
    }
    return next;
  }
  return value;
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function mergeApplicationFormData<T>(base: T, patch: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch as T) ?? base;
  }
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const previous = out[key];
    if (Array.isArray(value)) {
      out[key] = value;
    } else if (isPlainObject(value) && isPlainObject(previous)) {
      out[key] = mergeApplicationFormData(previous, value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export function isMeaningfulApplicationDraft(
  payload: ApplicationDraftPayload,
): boolean {
  if (payload.currentStep > 0) return true;
  if (hasText(payload.selectedProduct) || hasText(payload.selectedCategory)) {
    return true;
  }
  if (payload.creditAuthorizationConsent) return true;
  if (payload.feeAgreementDraft && payload.feeAgreementDraft.include) return true;
  if (Object.keys(payload.dynamicFormData || {}).length > 0) return true;

  const formData = payload.formData || {};
  const borrower = isPlainObject(formData.borrower) ? formData.borrower : {};
  if (
    hasText(borrower.firstName) ||
    hasText(borrower.lastName) ||
    hasText(borrower.name) ||
    hasText(borrower.email) ||
    hasText(borrower.phone)
  ) {
    return true;
  }
  if (Array.isArray(formData.coBorrowers) && formData.coBorrowers.length > 0) {
    return true;
  }
  const loanRequest = isPlainObject(formData.loanRequest)
    ? formData.loanRequest
    : {};
  if (hasText(loanRequest.amount) || hasText(loanRequest.purpose)) return true;
  const entity = isPlainObject(formData.entity) ? formData.entity : {};
  if (hasText(entity.legalName)) return true;
  return false;
}

export function loadApplicationDraft(
  storageKey: string,
): ApplicationDraft | null {
  if (!storageKey || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ApplicationDraft;
    if (!parsed || parsed.version !== APPLICATION_DRAFT_VERSION) return null;
    if (!isPlainObject(parsed.formData)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveApplicationDraft(
  storageKey: string,
  payload: ApplicationDraftPayload,
): void {
  if (!storageKey || typeof localStorage === "undefined") return;
  try {
    if (!isMeaningfulApplicationDraft(payload)) {
      localStorage.removeItem(storageKey);
      return;
    }
    const draft: ApplicationDraft = {
      version: APPLICATION_DRAFT_VERSION,
      savedAt: new Date().toISOString(),
      currentStep: payload.currentStep,
      selectedProduct: payload.selectedProduct || "",
      selectedCategory: payload.selectedCategory || "",
      formData: (stripUnserializable(payload.formData) || {}) as Record<
        string,
        unknown
      >,
      dynamicFormData: (stripUnserializable(payload.dynamicFormData) ||
        {}) as Record<string, unknown>,
      creditAuthorizationConsent: Boolean(payload.creditAuthorizationConsent),
      feeAgreementDraft: payload.feeAgreementDraft
        ? (stripUnserializable(payload.feeAgreementDraft) as Record<
            string,
            unknown
          >)
        : null,
    };
    localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Quota or private-mode failures should never block the form.
  }
}

export function clearApplicationDraft(storageKey: string): void {
  if (!storageKey || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

export function formatDraftSavedAt(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatUsDate(date)} at ${time}`;
}

export function useLoanApplicationAutosave(
  enabled: boolean,
  storageKey: string,
  payload: ApplicationDraftPayload,
): void {
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      saveApplicationDraft(storageKey, payloadRef.current);
    }, 400);
    return () => window.clearTimeout(timer);
  });

  useEffect(() => {
    if (!enabled) return;
    const persist = () => saveApplicationDraft(storageKey, payloadRef.current);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    window.addEventListener("beforeunload", persist);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      persist();
      window.removeEventListener("pagehide", persist);
      window.removeEventListener("beforeunload", persist);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, storageKey]);
}
