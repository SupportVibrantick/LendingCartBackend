// Reusable validation hook + FieldError component for live per-field validation.
// - Live validation as user types (per user choice)
// - Red text + red border error display (per user choice)
// - Looks up rules from fieldValidationRules.ts by field key

import { useState } from "react";
import {
  FIELD_VALIDATION_RULES,
  type FieldValidationRule,
} from "./fieldValidationRules";
import { toNumber } from "./formatters";

export interface ValidationResult {
  error: string;
  hasError: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;
const SSN_REGEX = /^\d{3}-?\d{2}-?\d{4}$/;
const ZIP_REGEX = /^\d{5}(-\d{4})?$/;

function isEmpty(value: any): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isPastDate(value: string): boolean {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d <= today;
}

function isFutureDate(value: string): boolean {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() >= Date.now() - 24 * 60 * 60 * 1000;
}

/**
 * Validate a single value against a rule.
 */
export function validateValue(
  value: any,
  rule: FieldValidationRule,
): ValidationResult {
  // Empty check
  if (isEmpty(value)) {
    if (rule.required) {
      return {
        error: rule.errorMessage || "This field is required",
        hasError: true,
      };
    }
    return { error: "", hasError: false };
  }

  // Length checks for strings
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (rule.minLength !== undefined && trimmed.length < rule.minLength) {
      return {
        error: rule.errorMessage || `Minimum ${rule.minLength} characters`,
        hasError: true,
      };
    }
    if (rule.maxLength !== undefined && trimmed.length > rule.maxLength) {
      return {
        error: rule.errorMessage || `Maximum ${rule.maxLength} characters`,
        hasError: true,
      };
    }
  }

  // Pattern checks
  if (rule.pattern) {
    const str = String(value).trim();
    switch (rule.pattern) {
      case "email":
        if (!EMAIL_REGEX.test(str)) {
          return {
            error: rule.errorMessage || "Enter a valid email",
            hasError: true,
          };
        }
        break;
      case "phone":
        if (!PHONE_REGEX.test(str)) {
          return {
            error: rule.errorMessage || "Enter a valid US phone",
            hasError: true,
          };
        }
        break;
      case "ssn":
        if (!SSN_REGEX.test(str)) {
          return {
            error: rule.errorMessage || "Enter SSN XXX-XX-XXXX",
            hasError: true,
          };
        }
        break;
      case "zip":
        if (!ZIP_REGEX.test(str)) {
          return {
            error: rule.errorMessage || "Enter ZIP 12345 or 12345-6789",
            hasError: true,
          };
        }
        break;
      case "futureDate":
        if (!isFutureDate(str)) {
          return {
            error: rule.errorMessage || "Date must be in the future",
            hasError: true,
          };
        }
        break;
      case "pastDate":
        if (!isPastDate(str)) {
          return {
            error: rule.errorMessage || "Date must be in the past",
            hasError: true,
          };
        }
        // For DOB, also enforce 18+
        if (
          (rule as any).minAge !== undefined &&
          !isAtLeastYearsOld(str, (rule as any).minAge)
        ) {
          return {
            error:
              rule.errorMessage ||
              `Must be at least ${(rule as any).minAge} years old`,
            hasError: true,
          };
        }
        break;
      case "currency":
      case "percent":
        break;
    }
  }

  // Numeric range checks
  if (rule.min !== undefined || rule.max !== undefined) {
    const num = toNumber(value);
    if (Number.isNaN(num)) {
      return { error: rule.errorMessage || "Must be a number", hasError: true };
    }
    if (rule.min !== undefined && num < rule.min) {
      return {
        error: rule.errorMessage || `Must be at least ${rule.min}`,
        hasError: true,
      };
    }
    if (rule.max !== undefined && num > rule.max) {
      return {
        error: rule.errorMessage || `Must be at most ${rule.max}`,
        hasError: true,
      };
    }
  }

  return { error: "", hasError: false };
}

function isAtLeastYearsOld(dateStr: string, years: number): boolean {
  const dob = new Date(dateStr);
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= years;
}

/**
 * Resolve the validation rule for a given field key.
 * Supports indexed co-borrowers like "coBorrowers.0.name" by falling back to "coBorrower.name".
 */
export function getRuleForKey(fieldKey: string): FieldValidationRule | null {
  if (FIELD_VALIDATION_RULES[fieldKey]) {
    return FIELD_VALIDATION_RULES[fieldKey];
  }
  // Try stripping the index for arrays: coBorrowers.0.name → coBorrower.name
  const stripped = fieldKey.replace(/^\w+\.\d+\./, "");
  if (stripped !== fieldKey && FIELD_VALIDATION_RULES[stripped]) {
    return FIELD_VALIDATION_RULES[stripped];
  }
  // property.0.fieldAddress → property.fieldAddress
  if (FIELD_VALIDATION_RULES[stripped]) {
    return FIELD_VALIDATION_RULES[stripped];
  }
  return null;
}

/**
 * Hook to manage live per-field validation state.
 * Returns helpers to get/set errors and validate on change.
 */
export function useFieldValidation() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (fieldKey: string, value: any): string => {
    const rule = getRuleForKey(fieldKey);
    if (!rule) return "";
    const result = validateValue(value, rule);
    setErrors((prev) => {
      const next = { ...prev };
      if (result.hasError) {
        next[fieldKey] = result.error;
      } else {
        delete next[fieldKey];
      }
      return next;
    });
    return result.error;
  };

  const validateAll = (values: Record<string, any>): Record<string, string> => {
    const next: Record<string, string> = {};
    Object.entries(values).forEach(([key, value]) => {
      const rule = getRuleForKey(key);
      if (!rule) return;
      const result = validateValue(value, rule);
      if (result.hasError) next[key] = result.error;
    });
    setErrors(next);
    return next;
  };

  const clearError = (fieldKey: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  };

  const clearAll = () => setErrors({});

  const getError = (fieldKey: string): string => errors[fieldKey] || "";

  return { errors, validate, validateAll, clearError, clearAll, getError };
}

/**
 * Inline error message component - red text beneath input.
 * Use directly inside form fields.
 */
export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className="mt-1 text-xs text-red-600 font-medium"
      data-testid="field-error"
    >
      {error}
    </p>
  );
}

/**
 * Helper to compose className with red border when there's an error.
 */
export function fieldBorderClass(hasError: boolean, base = ""): string {
  return [
    base,
    hasError
      ? "border-red-500 ring-1 ring-red-200 focus:border-red-500 focus:ring-red-200"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
