import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { saveClientPortalSession } from "../../lib/clientPortalSession";

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://api.loanautomation.ai";

const LOAN_AUTOMATION_LOGO = "/loanAutomation.jpeg";

type AuthView = "login" | "set-password" | "forgot" | "reset";

type FormErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
};

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

const PASSWORD_RULES = [
  { id: "len", label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { id: "num", label: "One number", test: (p: string) => /[0-9]/.test(p) },
  {
    id: "special",
    label: "One special character",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
];

function validateStrongPassword(password: string) {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) return rule.label;
  }
  return null;
}

function inputWrap(hasError = false) {
  return `flex items-center gap-3 rounded-xl border px-4 py-3.5 transition focus-within:ring-2 focus-within:ring-[#13538A]/25 ${
    hasError
      ? "border-red-300 bg-red-50"
      : "border-slate-200 bg-slate-50 focus-within:border-[#13538A] focus-within:bg-white"
  }`;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
      {message}
    </p>
  );
}

export default function ClientAuth() {
  const { token } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const resetToken = searchParams.get("resetToken")?.trim() || "";

  const [bootLoading, setBootLoading] = useState(true);
  const [view, setView] = useState<AuthView>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<{
    email?: boolean;
    password?: boolean;
    confirmPassword?: boolean;
  }>({});

  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [resetTokenValid, setResetTokenValid] = useState(false);
  const [validatingReset, setValidatingReset] = useState(Boolean(resetToken));

  const ruleStatus = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(password) })),
    [password],
  );

  const clearErrors = () => setErrors({});

  const validateEmailField = (value: string) => {
    const clean = value.trim();
    if (!clean) return "Email is required";
    if (!EMAIL_REGEX.test(clean)) return "Please enter a valid email address";
    return undefined;
  };

  const validateLoginPassword = (value: string) => {
    if (!value) return "Password is required";
    if (value.length < 6) return "Password must be at least 6 characters";
    return undefined;
  };

  const validateSetPassword = (value: string) => {
    if (!value) return "Password is required";
    if (value.length < 6) return "Password must be at least 6 characters";
    return undefined;
  };

  const validateResetPassword = (value: string) => {
    if (!value) return "Password is required";
    return validateStrongPassword(value) || undefined;
  };

  const validateConfirmPassword = (value: string, currentPassword: string) => {
    if (!value) return "Please confirm your password";
    if (value !== currentPassword) return "Passwords do not match";
    return undefined;
  };

  const validateCurrentView = (): boolean => {
    const next: FormErrors = {};

    if (view === "login") {
      next.email = validateEmailField(email);
      next.password = validateLoginPassword(password);
    } else if (view === "forgot") {
      next.email = validateEmailField(email);
    } else if (view === "set-password") {
      next.password = validateSetPassword(password);
    } else if (view === "reset") {
      next.password = validateResetPassword(password);
      next.confirmPassword = validateConfirmPassword(
        confirmPassword,
        password,
      );
    }

    const cleaned: FormErrors = {};
    if (next.email) cleaned.email = next.email;
    if (next.password) cleaned.password = next.password;
    if (next.confirmPassword) cleaned.confirmPassword = next.confirmPassword;

    setErrors(cleaned);
    setTouched({
      email: true,
      password: true,
      confirmPassword: true,
    });

    return Object.keys(cleaned).length === 0;
  };

  useEffect(() => {
    if (resetToken) {
      setView("reset");
      validateResetToken(resetToken);
      setBootLoading(false);
      return;
    }
    checkUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, resetToken]);

  const checkUser = async () => {
    try {
      const clientToken = sessionStorage.getItem("client_token");

      if (!token) {
        if (clientToken) {
          window.location.href = "/client-portal";
          return;
        }
        setView("login");
        setEmail("");
        return;
      }

      const res = await axios.get(
        `${API_BASE}/client-portal/check-user?token=${token}`,
      );
      const data = res.data?.data;

      if (!data?.tokenValid) {
        toast.error("Invalid or expired link");
        setView("login");
        return;
      }

      setEmail(data.email || "");
      setView(data.userExists ? "login" : "set-password");
    } catch {
      toast.error("Something went wrong");
      setView("login");
    } finally {
      setBootLoading(false);
    }
  };

  const validateResetToken = async (value: string) => {
    setValidatingReset(true);
    try {
      const res = await axios.get(
        `${API_BASE}/client-portal/auth/reset-password/validate`,
        { params: { token: value } },
      );
      const valid = Boolean(res.data?.data?.valid);
      setResetTokenValid(valid);
      if (valid && res.data?.data?.email) {
        setEmail(res.data.data.email);
      }
      if (!valid) {
        toast.error("Invalid or expired reset link");
      }
    } catch {
      setResetTokenValid(false);
      toast.error("Unable to validate reset link");
    } finally {
      setValidatingReset(false);
    }
  };

  const handleLogin = async () => {
    if (!validateCurrentView()) return;

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/client-portal/auth/login`, {
        email: email.trim(),
        password,
      });

      const clientToken = res.data?.data?.token;
      const user = res.data?.data?.user;

      if (!clientToken) {
        toast.error("Token not received");
        return;
      }

      saveClientPortalSession(clientToken, user);
      toast.success("Login successful");
      window.location.href = `/client-portal`;
    } catch (err: any) {
      const message = err?.response?.data?.message || "Login failed";
      setErrors({
        email: message.toLowerCase().includes("email")
          ? message
          : undefined,
        password: message.toLowerCase().includes("email")
          ? undefined
          : message,
      });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetPassword = async () => {
    if (!validateCurrentView()) return;

    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/client-portal/auth/set-password`, {
        token,
        password,
      });

      toast.success("Password set successfully");

      const loginRes = await axios.post(
        `${API_BASE}/client-portal/auth/login`,
        { email, password },
      );

      const clientToken = loginRes.data?.data?.token;
      const user = loginRes.data?.data?.user;
      saveClientPortalSession(clientToken, user);
      window.location.href = `/client-portal/${token}`;
    } catch (err: any) {
      const message = err?.response?.data?.message || "Failed";
      setErrors({ password: message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!validateCurrentView()) return;

    setSubmitting(true);
    const toastId = toast.loading("Sending reset link...");
    try {
      const res = await axios.post(
        `${API_BASE}/client-portal/auth/forgot-password`,
        { email: email.trim().toLowerCase() },
      );
      setEmailSent(true);
      clearErrors();
      toast.success(
        res.data?.message || "Check your email for a reset link",
        { id: toastId },
      );
    } catch (err: any) {
      const message =
        err?.response?.data?.message || "Unable to send reset link";
      setErrors({ email: message });
      toast.error(message, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!validateCurrentView()) return;

    setSubmitting(true);
    const toastId = toast.loading("Updating password...");
    try {
      const res = await axios.post(
        `${API_BASE}/client-portal/auth/reset-password`,
        { token: resetToken, password },
      );
      setResetComplete(true);
      clearErrors();
      toast.success(res.data?.message || "Password updated", { id: toastId });
    } catch (err: any) {
      const message =
        err?.response?.data?.message || "Unable to reset password";
      setErrors({ password: message });
      toast.error(message, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const clearResetToken = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("resetToken");
    setSearchParams(next, { replace: true });
    setView("login");
    setPassword("");
    setConfirmPassword("");
    setResetComplete(false);
    setResetTokenValid(false);
    clearErrors();
    setTouched({});
  };

  const goToForgot = () => {
    setView("forgot");
    setEmailSent(false);
    setPassword("");
    clearErrors();
    setTouched({});
  };

  const goToLogin = () => {
    setView("login");
    setEmailSent(false);
    setPassword("");
    setConfirmPassword("");
    clearErrors();
    setTouched({});
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (view === "forgot") {
      void handleForgotPassword();
      return;
    }
    if (view === "reset") {
      void handleResetPassword();
      return;
    }
    if (view === "set-password") {
      void handleSetPassword();
      return;
    }
    void handleLogin();
  };

  const onEmailChange = (value: string) => {
    setEmail(value);
    if (!touched.email) return;
    setErrors((prev) => {
      const next = { ...prev };
      const err = validateEmailField(value);
      if (err) next.email = err;
      else delete next.email;
      return next;
    });
  };

  const onPasswordChange = (value: string) => {
    setPassword(value);
    if (!touched.password && !touched.confirmPassword) return;

    setErrors((prev) => {
      const next = { ...prev };
      if (touched.password) {
        const err =
          view === "reset"
            ? validateResetPassword(value)
            : view === "set-password"
              ? validateSetPassword(value)
              : validateLoginPassword(value);
        if (err) next.password = err;
        else delete next.password;
      }
      if (touched.confirmPassword || confirmPassword) {
        const confirmErr = validateConfirmPassword(confirmPassword, value);
        if (confirmErr && (view === "reset" || confirmPassword)) {
          next.confirmPassword = confirmErr;
        } else {
          delete next.confirmPassword;
        }
      }
      return next;
    });
  };

  const onConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (!touched.confirmPassword) return;
    setErrors((prev) => {
      const next = { ...prev };
      const err = validateConfirmPassword(value, password);
      if (err) next.confirmPassword = err;
      else delete next.confirmPassword;
      return next;
    });
  };

  if (bootLoading || (view === "reset" && validatingReset)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,#dbeafe_0%,#f8fafc_45%,#f1f5f9_100%)]">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#13538A]" />
          Loading…
        </div>
      </div>
    );
  }

  const title =
    view === "forgot"
      ? emailSent
        ? "Check your email"
        : "Forgot password"
      : view === "reset"
        ? resetComplete
          ? "Password updated"
          : "Set a new password"
        : view === "set-password"
          ? "Create your password"
          : "Welcome back";

  const subtitle =
    view === "forgot"
      ? emailSent
        ? `If an account exists for ${email.trim()}, we sent a reset link.`
        : "Enter your email and we’ll send a secure reset link."
      : view === "reset"
        ? resetComplete
          ? "You can now sign in with your new password."
          : resetTokenValid
            ? `Choose a new password for ${email || "your account"}.`
            : "This reset link is invalid or has expired."
        : view === "set-password"
          ? "Create a password to access your loan documents and applications."
          : "Sign in to upload documents and track your application.";

  const showEmailField =
    view === "login" ||
    view === "set-password" ||
    (view === "forgot" && !emailSent) ||
    (view === "reset" && resetTokenValid && !resetComplete);

  const showPasswordField =
    view === "login" ||
    view === "set-password" ||
    (view === "reset" && resetTokenValid && !resetComplete);

  const showConfirmField =
    view === "reset" && resetTokenValid && !resetComplete;

  const emailDisabled =
    Boolean(token) || view === "set-password" || view === "reset";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,#dbeafe_0%,#f8fafc_45%,#f1f5f9_100%)]">
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-indigo-100/50 blur-3xl" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-6">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-[560px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.35)] backdrop-blur"
          noValidate
        >
          <div className="border-b border-slate-100 bg-gradient-to-r from-[#183b57] to-[#36536c] px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/20 bg-white shadow-sm">
                <img
                  src={LOAN_AUTOMATION_LOGO}
                  alt="Loan Automation"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="text-base font-semibold tracking-tight">
                  Loan Automation
                </p>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-100/90">
                  Client Portal
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 py-7 sm:px-8">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[#13538A]/15 bg-[#13538A]/5 px-3 py-1 text-xs font-semibold text-[#13538A]">
              <ShieldCheck size={12} />
              {view === "forgot" || view === "reset"
                ? "Account recovery"
                : "Secure access"}
            </span>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              {subtitle}
            </p>

            <div className="mt-6 space-y-4">
              {view === "forgot" && emailSent ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Check your inbox and spam folder. The link expires in about an
                  hour.
                </div>
              ) : null}

              {view === "reset" && resetComplete ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  Your password was updated successfully.
                </div>
              ) : null}

              {showEmailField || showPasswordField ? (
                <>
                  {showEmailField ? (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Email address
                      </label>
                      <div className={inputWrap(Boolean(errors.email?.trim()))}>
                        <Mail
                          size={18}
                          className={`shrink-0 ${
                            errors.email?.trim()
                              ? "text-red-400"
                              : "text-slate-400"
                          }`}
                        />
                        <input
                          type="email"
                          autoComplete="email"
                          value={email}
                          disabled={emailDisabled}
                          placeholder="you@email.com"
                          aria-invalid={Boolean(errors.email?.trim())}
                          className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-500"
                          onChange={(e) => onEmailChange(e.target.value)}
                          onBlur={() => {
                            setTouched((prev) => ({ ...prev, email: true }));
                            if (!emailDisabled) {
                              const err = validateEmailField(email);
                              setErrors((prev) => {
                                const next = { ...prev };
                                if (err) next.email = err;
                                else delete next.email;
                                return next;
                              });
                            }
                          }}
                        />
                      </div>
                      <FieldError message={errors.email?.trim() || undefined} />
                    </div>
                  ) : null}

                  {showPasswordField ? (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        {view === "reset" ? "New password" : "Password"}
                      </label>
                      <div
                        className={inputWrap(Boolean(errors.password?.trim()))}
                      >
                        <LockKeyhole
                          size={18}
                          className={`shrink-0 ${
                            errors.password?.trim()
                              ? "text-red-400"
                              : "text-slate-400"
                          }`}
                        />
                        <input
                          type={showPassword ? "text" : "password"}
                          autoComplete={
                            view === "login"
                              ? "current-password"
                              : "new-password"
                          }
                          placeholder={
                            view === "login"
                              ? "Enter your password"
                              : "Create a password"
                          }
                          aria-invalid={Boolean(errors.password?.trim())}
                          className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                          value={password}
                          onChange={(e) => onPasswordChange(e.target.value)}
                          onBlur={() => {
                            setTouched((prev) => ({ ...prev, password: true }));
                            const err =
                              view === "reset"
                                ? validateResetPassword(password)
                                : view === "set-password"
                                  ? validateSetPassword(password)
                                  : validateLoginPassword(password);
                            setErrors((prev) => {
                              const next = { ...prev };
                              if (err) next.password = err;
                              else delete next.password;
                              return next;
                            });
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="text-slate-400 transition hover:text-slate-700"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                      <FieldError
                        message={errors.password?.trim() || undefined}
                      />
                    </div>
                  ) : null}

                  {showConfirmField ? (
                    <>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Confirm password
                        </label>
                        <div
                          className={inputWrap(
                            Boolean(errors.confirmPassword),
                          )}
                        >
                          <LockKeyhole
                            size={18}
                            className={`shrink-0 ${
                              errors.confirmPassword
                                ? "text-red-400"
                                : "text-slate-400"
                            }`}
                          />
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="Re-enter password"
                            aria-invalid={Boolean(errors.confirmPassword)}
                            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                            value={confirmPassword}
                            onChange={(e) =>
                              onConfirmPasswordChange(e.target.value)
                            }
                            onBlur={() => {
                              setTouched((prev) => ({
                                ...prev,
                                confirmPassword: true,
                              }));
                              const err = validateConfirmPassword(
                                confirmPassword,
                                password,
                              );
                              setErrors((prev) => {
                                const next = { ...prev };
                                if (err) next.confirmPassword = err;
                                else delete next.confirmPassword;
                                return next;
                              });
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="text-slate-400 transition hover:text-slate-700"
                            aria-label={
                              showConfirmPassword
                                ? "Hide password"
                                : "Show password"
                            }
                          >
                            {showConfirmPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                        </div>
                        <FieldError message={errors.confirmPassword} />
                      </div>

                      <ul className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                        {ruleStatus.map((rule) => (
                          <li
                            key={rule.id}
                            className={`flex items-center gap-2 text-xs ${
                              rule.ok ? "text-emerald-600" : "text-slate-500"
                            }`}
                          >
                            <CheckCircle2
                              size={14}
                              className={rule.ok ? "opacity-100" : "opacity-30"}
                            />
                            {rule.label}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {view === "set-password" ? (
                    <p className="text-xs text-slate-500">
                      Use at least 6 characters. You’ll be signed in after
                      saving.
                    </p>
                  ) : null}
                </>
              ) : null}

              {view === "login" ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={goToForgot}
                    className="text-sm font-medium text-[#13538A] transition hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              ) : null}

              {(view === "forgot" && emailSent) ||
              (view === "reset" && (resetComplete || !resetTokenValid)) ? (
                <button
                  type="button"
                  onClick={() => {
                    if (view === "reset") clearResetToken();
                    else goToLogin();
                  }}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#183b57] to-[#36536c] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#183b57]/20 transition hover:brightness-110"
                >
                  Back to sign in
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#183b57] to-[#36536c] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#183b57]/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Please wait…
                    </>
                  ) : view === "forgot" ? (
                    <>
                      Send reset link
                      <ArrowRight
                        size={18}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </>
                  ) : view === "reset" ? (
                    <>
                      Update password
                      <ArrowRight
                        size={18}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </>
                  ) : view === "set-password" ? (
                    <>
                      Set password & continue
                      <ArrowRight
                        size={18}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight
                        size={18}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </>
                  )}
                </button>
              )}

              {(view === "forgot" && !emailSent) ||
              (view === "reset" && resetTokenValid && !resetComplete) ? (
                <button
                  type="button"
                  onClick={() => {
                    if (view === "reset") clearResetToken();
                    else goToLogin();
                  }}
                  className="flex w-full items-center justify-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
                >
                  <ArrowLeft size={16} />
                  Back to sign in
                </button>
              ) : null}

              {view === "login" && !token ? (
                <p className="pt-1 text-center text-xs text-slate-400">
                  Need help? Contact your broker for portal access.
                </p>
              ) : null}
            </div>
          </div>
        </form>
      </div>

      <p className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-[11px] text-slate-400">
        <Link to="/signin" className="pointer-events-auto hover:underline">
          Broker sign in
        </Link>
      </p>
    </div>
  );
}
