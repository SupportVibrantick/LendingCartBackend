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
} from "lucide-react";
import { saveClientPortalSession } from "../../lib/clientPortalSession";
import "./clientPortalTheme.css";

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
  return `flex items-center gap-3 rounded-xl border px-4 py-3.5 transition focus-within:ring-2 focus-within:ring-[#4C78F5]/30 ${
    hasError
      ? "border-red-300 bg-red-50"
      : "border-gray-200 bg-gray-50 focus-within:border-[#4C78F5] focus-within:bg-white"
  }`;
}

const CLIENT_PORTAL_FEATURES = [
  "Upload and manage loan documents",
  "Fill and sign lender forms securely",
  "Track application progress in real time",
  "Chat directly with your broker team",
];

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
          window.location.replace("/client-portal");
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
      // Replace so browser Back does not return to the login screen.
      window.location.replace("/client-portal");
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
      // Prefer session portal URL so Back never reopens the invite/login flow.
      window.location.replace("/client-portal");
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
      <div className="client-portal flex min-h-screen items-center justify-center bg-white">
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-5 py-3 text-sm text-gray-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#4C78F5]" />
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

  const badgeLabel =
    view === "forgot" || view === "reset"
      ? "Account recovery"
      : view === "set-password"
        ? "Get started"
        : "Client Portal";

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
    <div className="client-portal relative min-h-screen bg-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Left — form panel (lender-style) */}
        <div className="relative flex min-h-screen w-full items-start justify-center overflow-y-auto bg-white lg:w-[48%] xl:w-[44%] lg:items-center">
          <div className="w-full max-w-md px-6 py-8 sm:px-10 lg:px-8 lg:py-10">
            {/* Mobile logo */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <img
                src={LOAN_AUTOMATION_LOGO}
                alt="Loan Automation"
                className="h-12 w-12 rounded-full ring-2 ring-[#4C78F5]/20"
              />
              <div>
                <p className="text-lg font-bold text-[#4C78F5]">
                  Loan Automation
                </p>
                <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                  Client Portal
                </p>
              </div>
            </div>

            <span className="mb-4 inline-flex rounded-full border border-[#4C78F5]/20 bg-[#4C78F5]/5 px-3 py-1 text-xs font-semibold text-[#4C78F5]">
              {badgeLabel}
            </span>

            <h1 className="text-[26px] font-semibold tracking-tight text-[#111827]">
              {title}
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
              {subtitle}
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
              {view === "forgot" && emailSent ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
                  Check your inbox and spam folder. The link expires in about an
                  hour.
                </div>
              ) : null}

              {view === "reset" && resetComplete ? (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  Your password was updated successfully.
                </div>
              ) : null}

              {showEmailField ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <div className={inputWrap(Boolean(errors.email?.trim()))}>
                    <Mail
                      size={18}
                      className={
                        errors.email?.trim() ? "text-red-400" : "text-gray-400"
                      }
                    />
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      disabled={emailDisabled}
                      placeholder="you@email.com"
                      aria-invalid={Boolean(errors.email?.trim())}
                      className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:text-gray-500"
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
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {view === "reset" ? "New password" : "Password"}
                  </label>
                  <div className={inputWrap(Boolean(errors.password?.trim()))}>
                    <LockKeyhole
                      size={18}
                      className={
                        errors.password?.trim()
                          ? "text-red-400"
                          : "text-gray-400"
                      }
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        view === "login" ? "current-password" : "new-password"
                      }
                      placeholder={
                        view === "login"
                          ? "Enter your password"
                          : "Create a password"
                      }
                      aria-invalid={Boolean(errors.password?.trim())}
                      className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
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
                      className="text-gray-400 transition hover:text-gray-600"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <FieldError message={errors.password?.trim() || undefined} />
                </div>
              ) : null}

              {showConfirmField ? (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Confirm password
                    </label>
                    <div
                      className={inputWrap(Boolean(errors.confirmPassword))}
                    >
                      <LockKeyhole
                        size={18}
                        className={
                          errors.confirmPassword
                            ? "text-red-400"
                            : "text-gray-400"
                        }
                      />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Re-enter password"
                        aria-invalid={Boolean(errors.confirmPassword)}
                        className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
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
                        className="text-gray-400 transition hover:text-gray-600"
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

                  <ul className="space-y-1.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                    {ruleStatus.map((rule) => (
                      <li
                        key={rule.id}
                        className={`flex items-center gap-2 text-xs ${
                          rule.ok ? "text-emerald-600" : "text-gray-500"
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
                <p className="text-xs text-gray-500">
                  Use at least 6 characters. You’ll be signed in after saving.
                </p>
              ) : null}

              {view === "login" ? (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={goToForgot}
                    className="text-sm font-medium text-[#4C78F5] transition hover:text-[#3B66E0]"
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
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#4C78F5] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#4C78F5]/25 transition hover:bg-[#3B66E0] hover:shadow-[#4C78F5]/40"
                >
                  Back to sign in
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#4C78F5] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#4C78F5]/25 transition hover:bg-[#3B66E0] hover:shadow-[#4C78F5]/40 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Please wait…
                    </>
                  ) : view === "forgot" ? (
                    <>
                      Send reset link
                      <ArrowRight
                        size={18}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </>
                  ) : view === "reset" ? (
                    <>
                      Update password
                      <ArrowRight
                        size={18}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </>
                  ) : view === "set-password" ? (
                    <>
                      Set password & continue
                      <ArrowRight
                        size={18}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </>
                  ) : (
                    <>
                      Sign in to portal
                      <ArrowRight
                        size={18}
                        className="transition-transform group-hover:translate-x-0.5"
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
                  className="flex w-full items-center justify-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-800"
                >
                  <ArrowLeft size={16} />
                  Back to sign in
                </button>
              ) : null}

              {view === "login" && !token ? (
                <p className="text-center text-xs text-gray-400">
                  Need help? Contact your broker for portal access.
                </p>
              ) : null}
            </form>

            <div className="mt-8 space-y-1.5 text-center text-xs text-gray-400">
              <p>Developed by Vibrantick Inc</p>
              <Link
                to="/signin"
                className="font-medium text-gray-500 transition hover:text-[#4C78F5]"
              >
                Broker sign in
              </Link>
            </div>
          </div>
        </div>

        {/* Right — brand panel (lender-style) */}
        <div className="relative hidden overflow-hidden lg:flex lg:flex-1">
          <div className="absolute inset-0 bg-[linear-gradient(145deg,#4C78F5_0%,#3A5FD4_45%,#2E4BB0_100%)]" />
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-white/15 blur-[100px]" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#93B4FF]/20 blur-[80px]" />

          {/* Soft grid like lender GridShape */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              maskImage:
                "radial-gradient(ellipse 70% 70% at 50% 50%, black 15%, transparent 70%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 70% 70% at 50% 50%, black 15%, transparent 70%)",
            }}
          />

          <div className="relative z-10 flex flex-col items-center justify-center px-12 text-center">
            <div className="mb-8 block">
              <div className="mx-auto h-24 w-24 overflow-hidden rounded-full shadow-2xl shadow-black/30 ring-4 ring-white/15">
                <img
                  src={LOAN_AUTOMATION_LOGO}
                  alt="Loan Automation"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <h2 className="text-3xl font-semibold tracking-tight text-white xl:text-[34px]">
              Client Portal
            </h2>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/65">
              Your loan documents and progress, in one place.
            </p>

            <ul className="mt-10 space-y-3 text-left">
              {CLIENT_PORTAL_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 text-sm text-white/80"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs text-white">
                    {"\u2713"}
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
