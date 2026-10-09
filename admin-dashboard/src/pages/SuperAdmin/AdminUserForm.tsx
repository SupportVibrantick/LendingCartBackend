import React, { useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Shield,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import AdminPermissionSelector from "./AdminPermissionSelector";
import {
  emptyAdminForm,
  fetchPermissionGroups,
  getInitials,
  inputClass,
  passwordStrengthHint,
  type AdminUserForm as FormState,
  type PermissionGroup,
} from "./adminUserShared";
import { useAdminPermissions } from "../../context/AdminPermissionsContext";

type Props = {
  mode: "create" | "edit";
  initial?: Partial<FormState>;
  submitting?: boolean;
  onSubmit: (form: FormState) => Promise<void> | void;
  onCancel: () => void;
};

const AdminUserForm: React.FC<Props> = ({
  mode,
  initial,
  submitting = false,
  onSubmit,
  onCancel,
}) => {
  const { hasFullAccess, permissions: actorPermissions } = useAdminPermissions();
  const actorPermissionSet = useMemo(
    () => new Set(actorPermissions),
    [actorPermissions],
  );

  const [form, setForm] = useState<FormState>(() => ({
    ...emptyAdminForm(),
    ...initial,
  }));
  const [showPassword, setShowPassword] = useState(false);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const visibleGroups = useMemo(() => {
    if (hasFullAccess) return groups;
    return groups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((p) =>
          actorPermissionSet.has(p.key),
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [actorPermissionSet, groups, hasFullAccess]);

  useEffect(() => {
    if (initial) {
      setForm((prev) => ({ ...prev, ...initial }));
    }
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingPermissions(true);
        const data = await fetchPermissionGroups();
        if (!cancelled) setGroups(data);
      } catch {
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) setLoadingPermissions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.firstName.trim()) errors.firstName = "First name is required";
    if (!form.lastName.trim()) errors.lastName = "Last name is required";
    if (!form.email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Enter a valid email";
    }
    if (mode === "create") {
      const rules = passwordStrengthHint(form.password);
      if (!form.password) errors.password = "Password is required";
      else if (rules.some((r) => !r.ok)) {
        errors.password =
          "Password must be 8+ chars with upper, lower, number and special character";
      }
    }
    if (form.accessLevel === "CUSTOM" && form.permissions.length === 0) {
      errors.permissions = "Select at least one permission for custom access";
    }
    if (form.accessLevel === "FULL" && !hasFullAccess) {
      errors.accessLevel = "Only full-access administrators can grant Full Access";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit({
      ...form,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      permissions: form.accessLevel === "FULL" ? [] : form.permissions,
    });
  };

  const strength = passwordStrengthHint(form.password);
  const strengthScore = strength.filter((r) => r.ok).length;
  const displayName =
    [form.firstName, form.lastName].map((v) => v.trim()).filter(Boolean).join(" ") ||
    "New admin";
  const initials = getInitials(form.firstName, form.lastName);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#13538A]/10 text-sm font-bold text-[#13538A] dark:bg-sky-500/15 dark:text-sky-300">
            1
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Admin details
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Profile information used for login and display across the portal.
            </p>
          </div>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-200">
                First name *
              </label>
              <input
                className={inputClass}
                value={form.firstName}
                disabled={submitting}
                placeholder="Jane"
                onChange={(e) =>
                  setForm((f) => ({ ...f, firstName: e.target.value }))
                }
              />
              {fieldErrors.firstName && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.firstName}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-200">
                Last name *
              </label>
              <input
                className={inputClass}
                value={form.lastName}
                disabled={submitting}
                placeholder="Smith"
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastName: e.target.value }))
                }
              />
              {fieldErrors.lastName && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.lastName}</p>
              )}
            </div>
            <div className={mode === "edit" ? "sm:col-span-2" : undefined}>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-200">
                Email *
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  className={`${inputClass} pl-9`}
                  value={form.email}
                  disabled={submitting}
                  placeholder="admin@company.com"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            {mode === "create" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-200">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className={`${inputClass} pr-10`}
                    value={form.password}
                    disabled={submitting}
                    placeholder="Create a strong password"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.password}
                  </p>
                )}
              </div>
            )}

            {mode === "create" && (
              <div className="sm:col-span-2 space-y-2">
                <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                  <div
                    className={`h-full transition-all ${
                      strengthScore <= 2
                        ? "bg-rose-400"
                        : strengthScore <= 4
                          ? "bg-amber-400"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${(strengthScore / 5) * 100}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {strength.map((rule) => (
                    <span
                      key={rule.label}
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        rule.ok
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {rule.label}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Login credentials will be emailed to this admin after creation.
                </p>
              </div>
            )}
          </div>

          <aside className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Preview
            </p>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13538A] text-lg font-semibold text-white shadow-sm">
                {initials}
              </div>
              <p className="mt-3 truncate text-sm font-semibold text-gray-900 dark:text-white">
                {displayName}
              </p>
              <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-slate-400">
                {form.email.trim() || "email@company.com"}
              </p>
              <span
                className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  form.accessLevel === "FULL"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                }`}
              >
                {form.accessLevel === "FULL" ? (
                  <ShieldCheck className="h-3 w-3" />
                ) : (
                  <Shield className="h-3 w-3" />
                )}
                {form.accessLevel === "FULL" ? "Full access" : "Custom access"}
              </span>
              {form.accessLevel === "CUSTOM" && (
                <p className="mt-2 text-[11px] text-gray-500 dark:text-slate-400">
                  {form.permissions.length} permission
                  {form.permissions.length === 1 ? "" : "s"} selected
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>

      <section
        id="admin-permissions-section"
        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#13538A]/10 text-sm font-bold text-[#13538A] dark:bg-sky-500/15 dark:text-sky-300">
            2
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Access configuration
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Choose full platform access or a custom permission set.
            </p>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label
              className={`relative flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                form.accessLevel === "FULL"
                  ? "border-[#13538A] bg-[#13538A]/[0.04] shadow-sm ring-1 ring-[#13538A]/25 dark:border-sky-500 dark:bg-sky-500/10 dark:ring-sky-500/30"
                  : "border-gray-200 hover:border-gray-300 dark:border-slate-700 dark:hover:border-slate-600"
              } ${!hasFullAccess ? "opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="accessLevel"
                className="mt-1"
                checked={form.accessLevel === "FULL"}
                disabled={submitting || !hasFullAccess}
                onChange={() =>
                  setForm((f) => ({
                    ...f,
                    accessLevel: "FULL",
                    permissions: [],
                  }))
                }
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  Full Access
                </span>
                <span className="mt-2 block text-xs leading-relaxed text-gray-500 dark:text-slate-400">
                  All platform modules. New permissions apply automatically under
                  the full-access policy.
                </span>
                {!hasFullAccess && (
                  <span className="mt-2 block text-xs text-amber-600">
                    Only full-access admins can assign this level.
                  </span>
                )}
              </span>
            </label>

            <label
              className={`relative flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                form.accessLevel === "CUSTOM"
                  ? "border-[#13538A] bg-[#13538A]/[0.04] shadow-sm ring-1 ring-[#13538A]/25 dark:border-sky-500 dark:bg-sky-500/10 dark:ring-sky-500/30"
                  : "border-gray-200 hover:border-gray-300 dark:border-slate-700 dark:hover:border-slate-600"
              }`}
            >
              <input
                type="radio"
                name="accessLevel"
                className="mt-1"
                checked={form.accessLevel === "CUSTOM"}
                disabled={submitting}
                onChange={() =>
                  setForm((f) => ({ ...f, accessLevel: "CUSTOM" }))
                }
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                    <Shield className="h-4 w-4" />
                  </span>
                  Custom Access
                </span>
                <span className="mt-2 block text-xs leading-relaxed text-gray-500 dark:text-slate-400">
                  Only the modules and actions you select below. New permissions
                  are not granted automatically.
                </span>
              </span>
            </label>
          </div>
          {fieldErrors.accessLevel && (
            <p className="text-xs text-red-600">{fieldErrors.accessLevel}</p>
          )}

          {form.accessLevel === "CUSTOM" && (
            <div>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-slate-100">
                    <UserRound className="h-4 w-4 text-[#13538A]" />
                    Module permissions
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                    Each group matches a sidebar area. Loan Pipeline is view-only.
                  </p>
                </div>
                {!hasFullAccess && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    Limited to permissions you hold
                  </span>
                )}
              </div>
              <AdminPermissionSelector
                groups={visibleGroups}
                selected={form.permissions}
                loading={loadingPermissions}
                disabled={submitting}
                onChange={(permissions) =>
                  setForm((f) => ({ ...f, permissions }))
                }
              />
              {fieldErrors.permissions && (
                <p className="mt-2 text-xs text-red-600">
                  {fieldErrors.permissions}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <div className="sticky bottom-3 z-10 overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {mode === "create"
              ? "Credentials are emailed after a successful create."
              : "Permission changes apply after the admin refreshes or re-logs in."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-[#13538A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0f4470] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === "create" ? "Creating…" : "Saving…"}
                </>
              ) : mode === "create" ? (
                "Create Admin"
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default AdminUserForm;
