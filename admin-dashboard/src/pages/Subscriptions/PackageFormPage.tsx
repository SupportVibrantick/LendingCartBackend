import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiDollarSign,
  FiLayers,
  FiList,
  FiSave,
  FiShield,
  FiTag,
  FiUsers,
} from "react-icons/fi";
import { HiSparkles } from "react-icons/hi2";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";
import PackageMarketingFeaturesEditor from "../../components/subscriptions/PackageMarketingFeaturesEditor";
import SubscriptionNav from "../../components/subscriptions/SubscriptionNav";
import {
  SubscriptionPageShell,
  filterControlClass,
} from "../../components/subscriptions/SubscriptionUi";
import type { PackageFeatureGroup } from "../../data/packageFeatureLibrary";
import {
  groupsToSelectedIds,
  PACKAGE_FEATURE_TEMPLATES,
} from "../../data/packageFeatureLibrary";
import { getPackageCodeLabel } from "../../lib/packageDisplay";
import {
  buildPackageFeaturesJson,
  createPackage,
  featureGroupsFromPackage,
  fetchPackageFeatureDefaults,
  fetchPackages,
  parseFeaturesPayload,
  updatePackage,
  ADMIN_USAGE_LIMIT_METRICS,
  USAGE_METRIC_LABELS,
  type SubscriptionPackage,
  type UsageLimits,
} from "../../lib/subscriptionApi";

type PackageFormState = {
  name: string;
  code: string;
  priceMonthly: string;
  priceYearly: string;
  priceYearlyMonthly: string;
  description: string;
  badge: string;
  usersLabel: string;
  includedUsers: string;
  maxUsers: string;
  extraUserPrice: string;
  sortOrder: string;
  isPopular: boolean;
  usageLimits: UsageLimits;
  featureGroups: PackageFeatureGroup[];
};

const EMPTY_USAGE: UsageLimits = {};

const EMPTY_FORM: PackageFormState = {
  name: "",
  code: "",
  priceMonthly: "",
  priceYearly: "",
  priceYearlyMonthly: "",
  description: "",
  badge: "",
  usersLabel: "",
  includedUsers: "",
  maxUsers: "",
  extraUserPrice: "",
  sortOrder: "0",
  isPopular: false,
  usageLimits: { ...EMPTY_USAGE },
  featureGroups: [],
};

/** Package form usage caps — excludes legacy ACTIVE_USERS. */
const USAGE_METRICS = ADMIN_USAGE_LIMIT_METRICS;

const TIER_QUICK_CODES = ["BASIC", "PRO", "ELITE"] as const;

const FORM_STEPS = [
  {
    id: "plan",
    title: "Plan & pricing",
    description: "Name, code, and billing",
    icon: FiLayers,
  },
  {
    id: "card",
    title: "Card & limits",
    description: "Marketing copy and caps",
    icon: FiTag,
  },
  {
    id: "features",
    title: "Features",
    description: "Loan AI pricing bullets",
    icon: FiList,
  },
  {
    id: "review",
    title: "Review",
    description: "Confirm and save",
    icon: FiCheck,
  },
] as const;

/** Money: digits + optional one decimal, max 2 places. */
function sanitizeMoneyInput(raw: string): string {
  let next = String(raw ?? "").replace(/[^\d.]/g, "");
  const firstDot = next.indexOf(".");
  if (firstDot !== -1) {
    next =
      next.slice(0, firstDot + 1) +
      next.slice(firstDot + 1).replace(/\./g, "");
    const [whole, frac = ""] = next.split(".");
    next = `${whole}.${frac.slice(0, 2)}`;
  }
  if (next.startsWith(".")) next = `0${next}`;
  return next;
}

/** Non-negative integers only. */
function sanitizeIntInput(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "");
}

function parseOptionalNumber(raw: string): number | null {
  if (!String(raw ?? "").trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

type FieldErrors = Partial<Record<string, string>>;

const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  codeMin: 2,
  codeMax: 32,
  priceMin: 0.01,
  priceMax: 999_999.99,
  sortOrderMin: 0,
  sortOrderMax: 999,
  usersMin: 1,
  usersMax: 500,
  usageLimitMin: 0,
  usageLimitMax: 1_000_000,
  descriptionMax: 500,
  badgeMax: 40,
  usersLabelMax: 120,
} as const;

function validateMoneyField(
  label: string,
  raw: string,
  opts: { required?: boolean; min?: number; max?: number } = {},
): string | null {
  const required = opts.required === true;
  const min = opts.min ?? LIMITS.priceMin;
  const max = opts.max ?? LIMITS.priceMax;
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return required ? `${label} is required` : null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return `${label} must be a valid number (max 2 decimals)`;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return `${label} must be a valid number`;
  if (n < min) return `${label} must be at least ${min}`;
  if (n > max) return `${label} must be at most ${max.toLocaleString()}`;
  return null;
}

function validateIntField(
  label: string,
  raw: string,
  opts: { required?: boolean; min: number; max: number } ,
): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return opts.required ? `${label} is required` : null;
  if (!/^\d+$/.test(trimmed)) return `${label} must be a whole number`;
  const n = Number(trimmed);
  if (!Number.isInteger(n)) return `${label} must be a whole number`;
  if (n < opts.min) return `${label} must be at least ${opts.min}`;
  if (n > opts.max) return `${label} must be at most ${opts.max}`;
  return null;
}

function validatePlanStep(form: PackageFormState): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Package name is required";
  else if (name.length < LIMITS.nameMin) {
    errors.name = `Name must be at least ${LIMITS.nameMin} characters`;
  } else if (name.length > LIMITS.nameMax) {
    errors.name = `Name must be at most ${LIMITS.nameMax} characters`;
  }

  const code = form.code.trim().toUpperCase();
  if (!code) errors.code = "Package code is required";
  else if (code.length < LIMITS.codeMin) {
    errors.code = `Code must be at least ${LIMITS.codeMin} characters`;
  } else if (code.length > LIMITS.codeMax) {
    errors.code = `Code must be at most ${LIMITS.codeMax} characters`;
  } else if (!/^[A-Z0-9_]+$/.test(code)) {
    errors.code = "Code must be uppercase letters, numbers, or underscores";
  }

  const sortErr = validateIntField("Sort order", form.sortOrder, {
    required: true,
    min: LIMITS.sortOrderMin,
    max: LIMITS.sortOrderMax,
  });
  if (sortErr) errors.sortOrder = sortErr;

  const monthlyErr = validateMoneyField("Monthly price", form.priceMonthly, {
    required: true,
  });
  if (monthlyErr) errors.priceMonthly = monthlyErr;

  const yearlyErr = validateMoneyField("Yearly charge", form.priceYearly);
  if (yearlyErr) errors.priceYearly = yearlyErr;

  const yearlyMoErr = validateMoneyField(
    "Yearly display per month",
    form.priceYearlyMonthly,
  );
  if (yearlyMoErr) errors.priceYearlyMonthly = yearlyMoErr;

  const monthly = parseOptionalNumber(form.priceMonthly);
  const yearly = parseOptionalNumber(form.priceYearly);
  if (
    monthly != null &&
    yearly != null &&
    yearly < monthly &&
    !errors.priceYearly
  ) {
    errors.priceYearly = "Yearly charge should be greater than or equal to monthly price";
  }

  if (form.description.trim().length > LIMITS.descriptionMax) {
    errors.description = `Description must be at most ${LIMITS.descriptionMax} characters`;
  }

  return errors;
}

function validateCardStep(form: PackageFormState): FieldErrors {
  const errors: FieldErrors = {};

  if (form.badge.trim().length > LIMITS.badgeMax) {
    errors.badge = `Badge must be at most ${LIMITS.badgeMax} characters`;
  }
  if (form.usersLabel.trim().length > LIMITS.usersLabelMax) {
    errors.usersLabel = `Users label must be at most ${LIMITS.usersLabelMax} characters`;
  }

  const includedErr = validateIntField("Included users", form.includedUsers, {
    min: LIMITS.usersMin,
    max: LIMITS.usersMax,
  });
  if (includedErr) errors.includedUsers = includedErr;

  const maxErr = validateIntField("Max users", form.maxUsers, {
    min: LIMITS.usersMin,
    max: LIMITS.usersMax,
  });
  if (maxErr) errors.maxUsers = maxErr;

  const included = parseOptionalNumber(form.includedUsers);
  const maxUsers = parseOptionalNumber(form.maxUsers);
  if (
    included != null &&
    maxUsers != null &&
    maxUsers < included &&
    !errors.maxUsers
  ) {
    errors.maxUsers = "Max users must be greater than or equal to included users";
  }

  const extraErr = validateMoneyField("Extra user price", form.extraUserPrice, {
    min: 0,
  });
  if (extraErr) errors.extraUserPrice = extraErr;

  for (const metric of USAGE_METRICS) {
    const raw = form.usageLimits[metric];
    if (raw == null) continue;
    const err = validateIntField(USAGE_METRIC_LABELS[metric], String(raw), {
      min: LIMITS.usageLimitMin,
      max: LIMITS.usageLimitMax,
    });
    if (err) errors[`usage_${metric}`] = err;
  }

  return errors;
}

function firstErrorMessage(errors: FieldErrors): string | null {
  const values = Object.values(errors).filter(Boolean);
  return values.length ? String(values[0]) : null;
}

function blockInvalidNumberKeys(e: KeyboardEvent<HTMLInputElement>) {
  if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
}

function FormStepper({
  current,
  onStepClick,
}: {
  current: number;
  onStepClick: (index: number) => void;
}) {
  return (
    <nav
      aria-label="Package form progress"
      className="mb-6 overflow-x-auto rounded-2xl border border-slate-200/90 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <ol className="flex min-w-[640px] items-center gap-1 sm:min-w-0 sm:gap-0">
        {FORM_STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const Icon = step.icon;
          const clickable = index < current;

          return (
            <li key={step.id} className="flex flex-1 items-center">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(index)}
                className={`group flex w-full flex-col items-center gap-1 rounded-xl px-2 py-2 transition sm:flex-row sm:justify-center sm:gap-2 sm:px-3 ${
                  clickable
                    ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    : "cursor-default"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition ${
                    done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : active
                        ? "border-[#13538A] bg-[#13538A] text-white"
                        : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800"
                  }`}
                >
                  {done ? <FiCheck size={16} /> : <Icon size={16} />}
                </span>
                <span className="min-w-0 text-center sm:text-left">
                  <span
                    className={`block text-[11px] font-bold uppercase tracking-wide sm:text-xs ${
                      active
                        ? "text-[#13538A] dark:text-indigo-300"
                        : done
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-slate-400"
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="hidden text-[11px] text-slate-400 sm:block">
                    {step.description}
                  </span>
                </span>
              </button>
              {index < FORM_STEPS.length - 1 ? (
                <div
                  className={`mx-1 hidden h-0.5 flex-1 rounded-full sm:block ${
                    index < current
                      ? "bg-emerald-400"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-xs text-slate-500 sm:hidden">
        Step {current + 1} of {FORM_STEPS.length}: {FORM_STEPS[current].title}
      </p>
    </nav>
  );
}

const sectionCardClass =
  "rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900";

function FieldLabel({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {children}
      </label>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

function inputErrorClass(hasError?: boolean) {
  return hasError
    ? "border-red-400 focus:border-red-500 focus:ring-red-200 dark:border-red-500/60"
    : "";
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#13538A]/15 to-[#18B6B4]/10 text-[#13538A] dark:from-indigo-500/20 dark:to-teal-500/10 dark:text-indigo-300">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg dark:text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatMoneyValue(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

function MoneyInput({
  value,
  onChange,
  placeholder,
  min = 0,
  max = LIMITS.priceMax,
  hasError,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  hasError?: boolean;
}) {
  return (
    <div>
      <div
        className={`flex h-[42px] items-stretch overflow-hidden rounded-xl border bg-white dark:bg-slate-900 ${
          hasError
            ? "border-red-400 dark:border-red-500/60"
            : "border-slate-200 dark:border-slate-700"
        } focus-within:ring-2 focus-within:ring-[#18B6B4]/25`}
      >
        <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          $
        </span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onKeyDown={blockInvalidNumberKeys}
          onChange={(e) => onChange(sanitizeMoneyInput(e.target.value))}
          onBlur={() => {
            const n = parseOptionalNumber(value);
            if (n == null) return;
            onChange(formatMoneyValue(Math.min(max, Math.max(min, n))));
          }}
          placeholder={placeholder}
          aria-invalid={hasError || undefined}
          className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-slate-900 outline-none dark:text-white"
        />
      </div>
      <p className="mt-1 text-[10px] text-slate-400">
        Min ${min} · Max ${max.toLocaleString()}
      </p>
    </div>
  );
}

function IntegerInput({
  value,
  onChange,
  placeholder,
  min,
  max,
  hasError,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min: number;
  max: number;
  hasError?: boolean;
}) {
  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onKeyDown={blockInvalidNumberKeys}
        onChange={(e) => onChange(sanitizeIntInput(e.target.value))}
        onBlur={() => {
          if (!value.trim()) return;
          const n = Number(value);
          if (!Number.isFinite(n)) {
            onChange("");
            return;
          }
          const clamped = Math.min(max, Math.max(min, Math.floor(n)));
          onChange(String(clamped));
        }}
        placeholder={placeholder}
        aria-invalid={hasError || undefined}
        className={`w-full ${filterControlClass} ${inputErrorClass(hasError)}`}
      />
      <p className="mt-1 text-[10px] text-slate-400">
        Min {min} · Max {max.toLocaleString()}
      </p>
    </>
  );
}

function packageToForm(pkg: SubscriptionPackage): PackageFormState {
  const payload = parseFeaturesPayload(pkg.features);
  return {
    name: pkg.name,
    code: pkg.code,
    priceMonthly: String(pkg.priceMonthly),
    priceYearly: pkg.priceYearly != null ? String(pkg.priceYearly) : "",
    priceYearlyMonthly:
      payload?.priceYearlyMonthly != null
        ? String(payload.priceYearlyMonthly)
        : "",
    description: pkg.description || "",
    badge: payload?.badge ? String(payload.badge) : "",
    usersLabel: payload?.usersLabel ? String(payload.usersLabel) : "",
    includedUsers:
      payload?.includedUsers != null ? String(payload.includedUsers) : "",
    maxUsers: payload?.maxUsers != null ? String(payload.maxUsers) : "",
    extraUserPrice:
      payload?.extraUserPrice != null ? String(payload.extraUserPrice) : "",
    sortOrder: String(pkg.sortOrder ?? 0),
    isPopular: Boolean(pkg.isPopular),
    usageLimits: (() => {
      const next: UsageLimits = { ...(pkg.usageLimits || {}) };
      delete next.ACTIVE_USERS;
      return next;
    })(),
    featureGroups: featureGroupsFromPackage(pkg.features),
  };
}

export default function PackageFormPage() {
  const [searchParams] = useSearchParams();
  const packageId = searchParams.get("id");
  const isEdit = Boolean(packageId);
  const navigate = useNavigate();
  const { can } = useAdminPermissions();
  const canSave = isEdit ? can("UPDATE_SUBSCRIPTION") : can("CREATE_SUBSCRIPTION");

  const [form, setForm] = useState<PackageFormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [permissionPreview, setPermissionPreview] = useState<string[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [step, setStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const lastStepIndex = FORM_STEPS.length - 1;
  const stepRef = useRef(step);
  /** Blocks accidental Save right after Next lands on Review (double-click / Enter). */
  const saveUnlockedAtRef = useRef(0);

  useEffect(() => {
    stepRef.current = step;
    if (step === lastStepIndex) {
      saveUnlockedAtRef.current = Date.now() + 400;
    }
  }, [step, lastStepIndex]);

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const loadPackage = useCallback(async () => {
    if (!packageId) return;
    try {
      setLoading(true);
      const json = await fetchPackages({ page: 1, limit: 100 });
      if (!json.success) {
        toast.error(json.message || "Failed to load package");
        return;
      }
      const pkg = (json.data || []).find((p) => String(p.id) === packageId);
      if (!pkg) {
        toast.error("Package not found");
        navigate("/all-subscriptions");
        return;
      }
      setForm(packageToForm(pkg));
    } catch {
      toast.error("Failed to load package");
    } finally {
      setLoading(false);
    }
  }, [packageId, navigate]);

  useEffect(() => {
    if (isEdit) void loadPackage();
  }, [isEdit, loadPackage]);

  const applyCodeTemplate = (code: string) => {
    const upper = code.trim().toUpperCase();
    const tpl = PACKAGE_FEATURE_TEMPLATES[upper];
    if (!tpl) return;
    setForm((f) => ({
      ...f,
      featureGroups: tpl.groups.map((g) => ({
        ...g,
        items: [...g.items],
      })),
    }));
  };

  useEffect(() => {
    const code = form.code.trim().toUpperCase();
    if (!code || !["BASIC", "PRO", "ELITE"].includes(code)) {
      setPermissionPreview([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingPermissions(true);
        const json = await fetchPackageFeatureDefaults({
          packageCode: code,
          packageId: packageId || undefined,
        });
        if (cancelled) return;
        if (json.success && json.data?.defaults) {
          setPermissionPreview(json.data.defaults);
        }
      } catch {
        if (!cancelled) setPermissionPreview([]);
      } finally {
        if (!cancelled) setLoadingPermissions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.code, packageId]);

  const permissionCountLabel = useMemo(() => {
    if (loadingPermissions) return "Loading broker permissions…";
    if (!form.code.trim()) return "Enter a package code to preview broker access defaults.";
    if (permissionPreview.length === 0) {
      return "No permission preview for this code (custom tiers use subscriber overrides).";
    }
    return `${permissionPreview.length} broker permission keys for ${form.code.toUpperCase()} (from platform defaults).`;
  }, [form.code, loadingPermissions, permissionPreview.length]);

  const selectedFeatureCount = useMemo(
    () => groupsToSelectedIds(form.featureGroups).size,
    [form.featureGroups],
  );

  const applyTierQuickPick = (code: (typeof TIER_QUICK_CODES)[number]) => {
    if (isEdit) return;
    setForm((f) => ({ ...f, code }));
    applyCodeTemplate(code);
  };

  const previewMonthly = form.priceMonthly
    ? Number(form.priceMonthly)
    : null;
  const previewYearlyMo = form.priceYearlyMonthly
    ? Number(form.priceYearlyMonthly)
    : form.priceYearly
      ? Math.round(Number(form.priceYearly) / 12)
      : null;

  const goNext = () => {
    const current = stepRef.current;
    if (current >= lastStepIndex) return;

    if (current === 0) {
      const errors = validatePlanStep(form);
      setFieldErrors(errors);
      const msg = firstErrorMessage(errors);
      if (msg) {
        toast.error(msg);
        return;
      }
    }
    if (current === 1) {
      const errors = validateCardStep(form);
      setFieldErrors(errors);
      const msg = firstErrorMessage(errors);
      if (msg) {
        toast.error(msg);
        return;
      }
    }
    if (current === 2 && selectedFeatureCount === 0) {
      toast.error("Select at least one pricing feature, or apply a tier template");
      return;
    }
    setFieldErrors({});
    setStep((s) => Math.min(lastStepIndex, s + 1));
  };

  const goBack = () => {
    setFieldErrors({});
    setStep((s) => Math.max(0, s - 1));
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSave || saving) return;

    // Only the Review step may save — ignore Enter / stray submit on earlier steps.
    if (stepRef.current !== lastStepIndex) {
      goNext();
      return;
    }

    if (Date.now() < saveUnlockedAtRef.current) {
      return;
    }

    const planErrors = validatePlanStep(form);
    if (firstErrorMessage(planErrors)) {
      setFieldErrors(planErrors);
      toast.error(firstErrorMessage(planErrors) || "Fix plan details");
      setStep(0);
      return;
    }

    const cardErrors = validateCardStep(form);
    if (firstErrorMessage(cardErrors)) {
      setFieldErrors(cardErrors);
      toast.error(firstErrorMessage(cardErrors) || "Fix card & limits");
      setStep(1);
      return;
    }

    if (selectedFeatureCount === 0) {
      toast.error("Select at least one pricing feature, or apply a tier template");
      setStep(2);
      return;
    }

    setFieldErrors({});

    const features = buildPackageFeaturesJson({
      groups: form.featureGroups,
      badge: form.badge,
      usersLabel: form.usersLabel,
      includedUsers: form.includedUsers,
      maxUsers: form.maxUsers,
      extraUserPrice: form.extraUserPrice,
      priceYearlyMonthly: form.priceYearlyMonthly,
    });

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      priceMonthly: Number(form.priceMonthly),
      priceYearly: form.priceYearly ? Number(form.priceYearly) : null,
      description: form.description.trim() || undefined,
      features,
      sortOrder: Number(form.sortOrder) || 0,
      isPopular: form.isPopular,
      usageLimits: (() => {
        const next: UsageLimits = { ...form.usageLimits };
        delete next.ACTIVE_USERS;
        return Object.keys(next).length > 0 ? next : null;
      })(),
    };

    try {
      setSaving(true);
      const json = isEdit
        ? await updatePackage({ id: packageId, ...payload })
        : await createPackage(payload);

      if (!json.success) {
        toast.error(json.message || "Save failed");
        return;
      }

      toast.success(isEdit ? "Package updated" : "Package created");
      navigate("/all-subscriptions");
    } finally {
      setSaving(false);
    }
  };

  if (!canSave) {
    return (
      <SubscriptionPageShell>
        <p className="py-20 text-center text-slate-500">
          You do not have permission to {isEdit ? "edit" : "create"} packages.
        </p>
      </SubscriptionPageShell>
    );
  }

  if (loading) {
    return (
      <SubscriptionPageShell>
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="h-[520px] animate-pulse rounded-2xl bg-slate-200 lg:col-span-5 dark:bg-slate-800" />
            <div className="h-[520px] animate-pulse rounded-2xl bg-slate-200 lg:col-span-7 dark:bg-slate-800" />
          </div>
        </div>
      </SubscriptionPageShell>
    );
  }

  return (
    <SubscriptionPageShell>
      <div className="mx-auto w-full max-w-7xl pb-28">
        <Link
          to="/all-subscriptions"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-[#13538A] dark:hover:text-indigo-400"
        >
          <FiArrowLeft size={14} />
          Back to packages
        </Link>

        <SubscriptionNav />

        <header className="mb-6 overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/80 to-[#13538A]/[0.04] p-5 sm:p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#18B6B4]">
                Subscription packages
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[#13538A] sm:text-3xl dark:text-indigo-300">
                {isEdit ? "Edit package" : "New package"}
              </h1>
              <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
                Set Loan AI pricing, card copy, usage caps, and selectable marketing
                features.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200">
                <FiDollarSign size={12} className="text-[#13538A]" />
                {previewMonthly != null && !Number.isNaN(previewMonthly)
                  ? `$${previewMonthly}/mo`
                  : "Monthly —"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                Yearly display{" "}
                {previewYearlyMo != null && !Number.isNaN(previewYearlyMo)
                  ? `$${previewYearlyMo}/mo`
                  : "—"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/90 px-3 py-1.5 text-xs font-semibold text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                {selectedFeatureCount} features selected
              </span>
            </div>
          </div>
        </header>

        <FormStepper
          current={step}
          onStepClick={(index) => setStep(index)}
        />

        <form
          id="package-form"
          onSubmit={(e) => {
            // Enter in inputs must never skip Review and save.
            e.preventDefault();
            if (stepRef.current === lastStepIndex) {
              void handleSubmit(e);
              return;
            }
            goNext();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "TEXTAREA") return;
            // Block implicit form submit from text fields; Next handles progression.
            if (tag === "INPUT") e.preventDefault();
          }}
          className="space-y-6"
        >
          {step === 0 ? (
            <section className={sectionCardClass}>
              <SectionHeader
                icon={<FiLayers size={18} />}
                title="Plan & pricing"
                description="Identity, billing amounts, and display order"
              />

              {!isEdit ? (
                <div className="mb-4">
                  <FieldLabel hint="Loads starter feature template + code">
                    Quick tier
                  </FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    {TIER_QUICK_CODES.map((code) => {
                      const active = form.code === code;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => applyTierQuickPick(code)}
                          className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                            active
                              ? "border-[#13538A] bg-[#13538A] text-white"
                              : "border-slate-200 bg-slate-50 text-slate-600 hover:border-[#13538A]/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {getPackageCodeLabel(code)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel>Package name</FieldLabel>
                  <input
                    value={form.name}
                    maxLength={LIMITS.nameMax}
                    onChange={(e) => {
                      clearFieldError("name");
                      setForm((f) => ({ ...f, name: e.target.value }));
                    }}
                    placeholder="e.g. Pro"
                    aria-invalid={Boolean(fieldErrors.name) || undefined}
                    className={`w-full ${filterControlClass} ${inputErrorClass(Boolean(fieldErrors.name))}`}
                  />
                  <FieldError message={fieldErrors.name} />
                </div>

                <div>
                  <FieldLabel>Code</FieldLabel>
                  <input
                    value={form.code}
                    maxLength={LIMITS.codeMax}
                    onChange={(e) => {
                      clearFieldError("code");
                      const code = e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9_]/g, "");
                      setForm((f) => ({ ...f, code }));
                    }}
                    onBlur={() => applyCodeTemplate(form.code)}
                    placeholder="PRO"
                    disabled={isEdit}
                    aria-invalid={Boolean(fieldErrors.code) || undefined}
                    className={`w-full font-mono text-sm disabled:opacity-60 ${filterControlClass} ${inputErrorClass(Boolean(fieldErrors.code))}`}
                  />
                  <FieldError message={fieldErrors.code} />
                </div>

                <div>
                  <FieldLabel>Sort order</FieldLabel>
                  <IntegerInput
                    value={form.sortOrder}
                    min={LIMITS.sortOrderMin}
                    max={LIMITS.sortOrderMax}
                    hasError={Boolean(fieldErrors.sortOrder)}
                    onChange={(sortOrder) => {
                      clearFieldError("sortOrder");
                      setForm((f) => ({ ...f, sortOrder }));
                    }}
                    placeholder="0"
                  />
                  <FieldError message={fieldErrors.sortOrder} />
                </div>

                <div>
                  <FieldLabel>Monthly price</FieldLabel>
                  <MoneyInput
                    value={form.priceMonthly}
                    min={LIMITS.priceMin}
                    max={LIMITS.priceMax}
                    hasError={Boolean(fieldErrors.priceMonthly)}
                    onChange={(priceMonthly) => {
                      clearFieldError("priceMonthly");
                      setForm((f) => ({ ...f, priceMonthly }));
                    }}
                    placeholder="499"
                  />
                  <FieldError message={fieldErrors.priceMonthly} />
                </div>

                <div>
                  <FieldLabel>Yearly charge</FieldLabel>
                  <MoneyInput
                    value={form.priceYearly}
                    min={LIMITS.priceMin}
                    max={LIMITS.priceMax}
                    hasError={Boolean(fieldErrors.priceYearly)}
                    onChange={(priceYearly) => {
                      clearFieldError("priceYearly");
                      setForm((f) => ({ ...f, priceYearly }));
                    }}
                    placeholder="4788"
                  />
                  <FieldError message={fieldErrors.priceYearly} />
                </div>

                <div className="sm:col-span-2">
                  <FieldLabel hint="Shown on yearly toggle (not necessarily yearly ÷ 12)">
                    Yearly display per month
                  </FieldLabel>
                  <MoneyInput
                    value={form.priceYearlyMonthly}
                    min={LIMITS.priceMin}
                    max={LIMITS.priceMax}
                    hasError={Boolean(fieldErrors.priceYearlyMonthly)}
                    onChange={(priceYearlyMonthly) => {
                      clearFieldError("priceYearlyMonthly");
                      setForm((f) => ({ ...f, priceYearlyMonthly }));
                    }}
                    placeholder="399"
                  />
                  <FieldError message={fieldErrors.priceYearlyMonthly} />
                </div>

                <div className="sm:col-span-2">
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    rows={2}
                    maxLength={LIMITS.descriptionMax}
                    value={form.description}
                    onChange={(e) => {
                      clearFieldError("description");
                      setForm((f) => ({ ...f, description: e.target.value }));
                    }}
                    placeholder="Who is this plan for?"
                    aria-invalid={Boolean(fieldErrors.description) || undefined}
                    className={`w-full resize-none ${filterControlClass} ${inputErrorClass(Boolean(fieldErrors.description))}`}
                  />
                  <FieldError message={fieldErrors.description} />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setForm((f) => ({ ...f, isPopular: !f.isPopular }))
                  }
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition sm:col-span-2 ${
                    form.isPopular
                      ? "border-amber-300/80 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-500/10"
                      : "border-slate-200 bg-slate-50/50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      form.isPopular
                        ? "bg-amber-200 text-amber-800 dark:bg-amber-500/30 dark:text-amber-200"
                        : "bg-white text-slate-400 dark:bg-slate-900"
                    }`}
                  >
                    <HiSparkles size={18} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-white">
                      Most popular plan
                    </span>
                    <span className="text-xs text-slate-500">
                      Highlights this tier on the Loan AI pricing page
                    </span>
                  </span>
                </button>
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <>
            <section className={sectionCardClass}>
              <SectionHeader
                icon={<FiTag size={18} />}
                title="Pricing card copy"
                description="Badge, seats, and extra-user pricing on marketing cards"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Badge</FieldLabel>
                  <input
                    value={form.badge}
                    maxLength={LIMITS.badgeMax}
                    onChange={(e) => {
                      clearFieldError("badge");
                      setForm((f) => ({ ...f, badge: e.target.value }));
                    }}
                    placeholder="MOST POPULAR"
                    aria-invalid={Boolean(fieldErrors.badge) || undefined}
                    className={`w-full ${filterControlClass} ${inputErrorClass(Boolean(fieldErrors.badge))}`}
                  />
                  <FieldError message={fieldErrors.badge} />
                </div>
                <div>
                  <FieldLabel>Users label</FieldLabel>
                  <input
                    value={form.usersLabel}
                    maxLength={LIMITS.usersLabelMax}
                    onChange={(e) => {
                      clearFieldError("usersLabel");
                      setForm((f) => ({ ...f, usersLabel: e.target.value }));
                    }}
                    placeholder="Add up to 5 users · $99/extra"
                    aria-invalid={Boolean(fieldErrors.usersLabel) || undefined}
                    className={`w-full ${filterControlClass} ${inputErrorClass(Boolean(fieldErrors.usersLabel))}`}
                  />
                  <FieldError message={fieldErrors.usersLabel} />
                </div>
                <div>
                  <FieldLabel>Included users</FieldLabel>
                  <IntegerInput
                    value={form.includedUsers}
                    min={LIMITS.usersMin}
                    max={LIMITS.usersMax}
                    hasError={Boolean(fieldErrors.includedUsers)}
                    onChange={(includedUsers) => {
                      clearFieldError("includedUsers");
                      clearFieldError("maxUsers");
                      setForm((f) => ({ ...f, includedUsers }));
                    }}
                    placeholder="1"
                  />
                  <FieldError message={fieldErrors.includedUsers} />
                </div>
                <div>
                  <FieldLabel>Max users</FieldLabel>
                  <IntegerInput
                    value={form.maxUsers}
                    min={LIMITS.usersMin}
                    max={LIMITS.usersMax}
                    hasError={Boolean(fieldErrors.maxUsers)}
                    onChange={(maxUsers) => {
                      clearFieldError("maxUsers");
                      setForm((f) => ({ ...f, maxUsers }));
                    }}
                    placeholder="5"
                  />
                  <FieldError message={fieldErrors.maxUsers} />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Extra user price (monthly)</FieldLabel>
                  <MoneyInput
                    value={form.extraUserPrice}
                    min={0}
                    max={LIMITS.priceMax}
                    hasError={Boolean(fieldErrors.extraUserPrice)}
                    onChange={(extraUserPrice) => {
                      clearFieldError("extraUserPrice");
                      setForm((f) => ({ ...f, extraUserPrice }));
                    }}
                    placeholder="99"
                  />
                  <FieldError message={fieldErrors.extraUserPrice} />
                </div>
              </div>
            </section>

            <section className={sectionCardClass}>
              <SectionHeader
                icon={<FiUsers size={18} />}
                title="Usage limits"
                description="Optional caps enforced per billing period"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {USAGE_METRICS.map((metric) => (
                  <div
                    key={metric}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <FieldLabel>{USAGE_METRIC_LABELS[metric]}</FieldLabel>
                    <IntegerInput
                      value={
                        form.usageLimits[metric] != null
                          ? String(form.usageLimits[metric])
                          : ""
                      }
                      min={LIMITS.usageLimitMin}
                      max={LIMITS.usageLimitMax}
                      hasError={Boolean(fieldErrors[`usage_${metric}`])}
                      onChange={(raw) => {
                        clearFieldError(`usage_${metric}`);
                        setForm((f) => {
                          const next = { ...f.usageLimits };
                          if (!raw.trim()) delete next[metric];
                          else next[metric] = Number(raw);
                          return { ...f, usageLimits: next };
                        });
                      }}
                      placeholder="Unlimited"
                    />
                    <FieldError message={fieldErrors[`usage_${metric}`]} />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-dashed border-[#13538A]/25 bg-[#13538A]/[0.03] p-5 dark:border-indigo-500/30 dark:bg-indigo-500/5">
              <div className="mb-2 flex items-center gap-2 text-[#13538A] dark:text-indigo-300">
                <FiShield size={16} />
                <h2 className="text-sm font-semibold">Broker access preview</h2>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {permissionCountLabel}
              </p>
              {permissionPreview.length > 0 ? (
                <div className="mt-3 max-h-28 overflow-y-auto rounded-lg bg-white/80 p-2 font-mono text-[10px] leading-relaxed text-slate-600 dark:bg-slate-900/80 dark:text-slate-400">
                  {permissionPreview.slice(0, 16).join(" · ")}
                  {permissionPreview.length > 16
                    ? ` · +${permissionPreview.length - 16} more`
                    : ""}
                </div>
              ) : null}
            </section>
            </>
          ) : null}

          {step === 2 ? (
            <section className={sectionCardClass}>
              <SectionHeader
                icon={<FiList size={18} />}
                title="Pricing page features"
                description="Choose bullets and dropdowns shown on Loan AI"
              />
              <PackageMarketingFeaturesEditor
                value={form.featureGroups}
                onChange={(featureGroups) =>
                  setForm((f) => ({ ...f, featureGroups }))
                }
                disabled={saving}
              />
            </section>
          ) : null}

          {step === 3 ? (
            <section className={sectionCardClass}>
              <SectionHeader
                icon={<FiCheck size={18} />}
                title="Review package"
                description="Confirm details before saving"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Plan
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                    {form.name || "—"}{" "}
                    <span className="text-sm font-normal text-slate-400">
                      ({form.code || "—"})
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    ${form.priceMonthly || "—"}/mo · yearly charge $
                    {form.priceYearly || "—"}
                    {form.priceYearlyMonthly
                      ? ` · display $${form.priceYearlyMonthly}/mo`
                      : ""}
                  </p>
                  {form.description ? (
                    <p className="mt-2 text-sm text-slate-500">{form.description}</p>
                  ) : null}
                  {form.isPopular ? (
                    <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                      Most popular
                    </span>
                  ) : null}
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Card & limits
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                    {form.badge ? <li>Badge: {form.badge}</li> : null}
                    {form.usersLabel ? <li>{form.usersLabel}</li> : null}
                    {form.includedUsers || form.maxUsers ? (
                      <li>
                        Users: {form.includedUsers || "?"} included, max{" "}
                        {form.maxUsers || "?"}
                      </li>
                    ) : null}
                    {form.extraUserPrice ? (
                      <li>Extra seat: ${form.extraUserPrice}/mo</li>
                    ) : null}
                    <li>{selectedFeatureCount} marketing features</li>
                    <li>
                      {Object.keys(form.usageLimits).length} usage limit
                      {Object.keys(form.usageLimits).length === 1 ? "" : "s"} set
                    </li>
                  </ul>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-500">{permissionCountLabel}</p>
            </section>
          ) : null}
        </form>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3.5 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {form.name.trim() || "Untitled package"}
              {form.code ? (
                <span className="ml-1.5 font-mono text-xs font-medium text-slate-400">
                  {form.code}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Step {step + 1} of {FORM_STEPS.length} · {FORM_STEPS[step].title}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/all-subscriptions"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-transparent px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              Cancel
            </Link>
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FiArrowLeft size={15} />
                Back
              </button>
            ) : null}
            {step < lastStepIndex ? (
              <button
                type="button"
                onClick={goNext}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#13538A] px-5 text-sm font-semibold text-white transition hover:bg-[#0f4470] disabled:opacity-60"
              >
                Next
                <FiArrowRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#13538A] px-5 text-sm font-semibold text-white transition hover:bg-[#0f4470] disabled:opacity-60"
              >
                <FiSave size={15} />
                {saving ? "Saving…" : isEdit ? "Save changes" : "Create package"}
              </button>
            )}
          </div>
        </div>
      </div>
    </SubscriptionPageShell>
  );
}