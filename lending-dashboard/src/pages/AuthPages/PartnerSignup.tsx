import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import { saveLenderSession } from "../../lib/lenderSession";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const US_PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;
const RECAPTCHA_ACTION = "lender_public_signup";

declare global {
  interface Window {
    grecaptcha?: {
      ready?: (cb: () => void) => void;
      execute?: (
        siteKey: string,
        options: { action: string },
      ) => Promise<string>;
    };
  }
}

function formatUSPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function cleanPhone(value: string) {
  return value.replace(/\D/g, "");
}

let recaptchaLoadPromise: Promise<void> | null = null;

function waitForGrecaptcha(timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const finish = () => {
      if (typeof window.grecaptcha?.execute === "function") {
        resolve();
        return;
      }
      reject(new Error("reCAPTCHA loaded but execute() is unavailable"));
    };

    const check = () => {
      const grecaptcha = window.grecaptcha;
      if (grecaptcha && typeof grecaptcha.ready === "function") {
        try {
          grecaptcha.ready(finish);
        } catch {
          // Some browsers expose grecaptcha before ready is usable
          if (typeof grecaptcha.execute === "function") {
            resolve();
          } else {
            reject(new Error("reCAPTCHA failed to initialize"));
          }
        }
        return;
      }

      if (typeof grecaptcha?.execute === "function") {
        resolve();
        return;
      }

      if (Date.now() - started > timeoutMs) {
        reject(
          new Error(
            "reCAPTCHA failed to initialize. Check site key and allowed domains.",
          ),
        );
        return;
      }

      window.setTimeout(check, 50);
    };

    check();
  });
}

async function loadRecaptchaScript(siteKey: string) {
  if (!siteKey) {
    throw new Error("reCAPTCHA site key is missing");
  }

  if (typeof window.grecaptcha?.execute === "function") {
    return;
  }

  if (recaptchaLoadPromise) {
    await recaptchaLoadPromise;
    return;
  }

  recaptchaLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(
      "recaptcha-v3",
    ) as HTMLScriptElement | null;

    if (existing) {
      waitForGrecaptcha().then(resolve).catch((err) => {
        recaptchaLoadPromise = null;
        reject(err);
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "recaptcha-v3";
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      waitForGrecaptcha().then(resolve).catch((err) => {
        recaptchaLoadPromise = null;
        reject(err);
      });
    };
    script.onerror = () => {
      recaptchaLoadPromise = null;
      script.remove();
      reject(
        new Error(
          "Failed to load reCAPTCHA script. Allow google.com/recaptcha or check your network.",
        ),
      );
    };
    document.head.appendChild(script);
  });

  await recaptchaLoadPromise;
}

async function getCaptchaToken(siteKey: string): Promise<string> {
  if (!siteKey) {
    throw new Error(
      "reCAPTCHA site key is not configured. Set RECAPTCHA_SITE_KEY on the server.",
    );
  }

  await loadRecaptchaScript(siteKey);

  const execute = window.grecaptcha?.execute;
  if (typeof execute !== "function") {
    throw new Error("reCAPTCHA is unavailable in this browser");
  }

  const token = await execute(siteKey, {
    action: RECAPTCHA_ACTION,
  });

  if (!token) {
    throw new Error(
      "Could not get reCAPTCHA token. Add this domain in Google reCAPTCHA settings.",
    );
  }

  return token;
}

type FormErrors = {
  organizationName?: string;
  organizationEmail?: string;
  organizationPhone?: string;
  adminEmail?: string;
  password?: string;
};

export default function PartnerSignup() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [captchaSiteKey, setCaptchaSiteKey] = useState("");
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState({
    organizationName: "",
    organizationEmail: "",
    organizationPhone: "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    password: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/lender/auth/register/public-config`);
        const json = await res.json().catch(() => ({}));
        if (cancelled || !json?.success) return;

        const envSiteKey = String(
          import.meta.env.VITE_RECAPTCHA_SITE_KEY || "",
        ).trim();
        const siteKey =
          String(json.data?.captchaSiteKey || "").trim() || envSiteKey;
        const required = Boolean(json.data?.captchaRequired) && Boolean(siteKey);

        setCaptchaRequired(required);
        setCaptchaSiteKey(siteKey);

        if (siteKey) {
          try {
            await loadRecaptchaScript(siteKey);
          } catch (err) {
            console.error("reCAPTCHA preload failed", err);
          }
        }
      } catch {
        // Config is optional in local/dev without captcha
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = <K extends keyof typeof form>(key: K, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as keyof FormErrors]) return prev;
      const next = { ...prev };
      delete next[key as keyof FormErrors];
      return next;
    });
  };

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!form.organizationName.trim()) {
      next.organizationName = "Company name is required";
    }
    if (!form.organizationEmail.trim()) {
      next.organizationEmail = "Company email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.organizationEmail.trim())) {
      next.organizationEmail = "Enter a valid email address";
    }

    const phoneDigits = cleanPhone(form.organizationPhone);
    if (form.organizationPhone.trim()) {
      if (phoneDigits.length !== 10 || !US_PHONE_REGEX.test(form.organizationPhone)) {
        next.organizationPhone = "Enter a valid phone (e.g. 333-333-3333)";
      }
    }

    if (!form.adminEmail.trim()) {
      next.adminEmail = "Work email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail.trim())) {
      next.adminEmail = "Enter a valid email address";
    }

    if (!form.password) {
      next.password = "Password is required";
    } else if (form.password.length < 8) {
      next.password = "Password must be at least 8 characters";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const fieldError = (message?: string) =>
    message ? (
      <p className="mt-1.5 text-xs font-medium text-red-500 dark:text-red-400">
        {message}
      </p>
    ) : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    try {
      setSaving(true);

      let captchaToken: string | undefined;
      if (captchaRequired) {
        try {
          captchaToken = await getCaptchaToken(captchaSiteKey);
        } catch (captchaErr: any) {
          console.error("reCAPTCHA token error", captchaErr);
          toast.error(
            captchaErr?.message ||
              "Captcha verification failed. Please try again.",
          );
          return;
        }
      }

      const phoneDigits = cleanPhone(form.organizationPhone);

      const res = await fetch(`${API_BASE}/lender/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: form.organizationName.trim(),
          organizationEmail: form.organizationEmail.trim(),
          organizationPhone: phoneDigits || undefined,
          adminFirstName: form.adminFirstName.trim() || undefined,
          adminLastName: form.adminLastName.trim() || undefined,
          adminEmail: form.adminEmail.trim(),
          password: form.password,
          source: "public",
          captchaToken,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        const apiErrors: FormErrors = {};
        if (json.code === "EMAIL_EXISTS" || json.field === "adminEmail") {
          apiErrors.adminEmail = json.message || "Email already registered";
        } else if (json.code === "ORG_EXISTS") {
          apiErrors.organizationName =
            json.message || "Organization already exists";
          apiErrors.organizationEmail =
            json.message || "Organization already exists";
        } else if (json.field === "password") {
          apiErrors.password = json.message || "Invalid password";
        } else if (json.field === "organizationPhone") {
          apiErrors.organizationPhone = json.message || "Invalid phone number";
        }

        if (Object.keys(apiErrors).length) {
          setErrors(apiErrors);
        }

        toast.error(json.message || "Failed to create account");
        return;
      }

      // Hard gate: public signup must verify email before session access
      if (json.data?.emailVerificationRequired) {
        toast.success("Account created. Please verify your email.");
        const pendingEmail = encodeURIComponent(
          String(json.data?.email || form.adminEmail.trim()),
        );
        navigate(`/verify-email-pending?email=${pendingEmail}`);
        return;
      }

      if (json.data?.token) {
        saveLenderSession(json.data.token, json.data.user || null);
        toast.success("Account created successfully");
        navigate("/");
        return;
      }

      toast.success("Account created. Please sign in.");
      navigate("/signin");
    } catch {
      toast.error("Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Partner Signup | LendingCart"
        description="Create your LendingCart lender partner account"
      />
      <AuthLayout wide>
        <div className="w-full">
          <div className="mb-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">
              Lending partner
            </p>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white sm:text-2xl">
              Create your lender account
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Sign up via the public partner link. Verify your email before signing in.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>
                  Company name <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  value={form.organizationName}
                  onChange={(e) => updateField("organizationName", e.target.value)}
                  placeholder="Your lending company"
                  error={Boolean(errors.organizationName)}
                  disabled={saving}
                />
                {fieldError(errors.organizationName)}
              </div>

              <div>
                <Label>
                  Company email <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="email"
                  value={form.organizationEmail}
                  onChange={(e) => updateField("organizationEmail", e.target.value)}
                  placeholder="company@example.com"
                  error={Boolean(errors.organizationEmail)}
                  disabled={saving}
                />
                {fieldError(errors.organizationEmail)}
              </div>

              <div>
                <Label>Company phone</Label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={12}
                  value={form.organizationPhone}
                  onChange={(e) =>
                    updateField("organizationPhone", formatUSPhone(e.target.value))
                  }
                  placeholder="333-333-3333"
                  error={Boolean(errors.organizationPhone)}
                  disabled={saving}
                />
                {fieldError(errors.organizationPhone)}
              </div>

              <div>
                <Label>First name</Label>
                <Input
                  type="text"
                  value={form.adminFirstName}
                  onChange={(e) => updateField("adminFirstName", e.target.value)}
                  placeholder="First name"
                  disabled={saving}
                />
              </div>

              <div>
                <Label>Last name</Label>
                <Input
                  type="text"
                  value={form.adminLastName}
                  onChange={(e) => updateField("adminLastName", e.target.value)}
                  placeholder="Last name"
                  disabled={saving}
                />
              </div>

              <div>
                <Label>
                  Work email <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="email"
                  autoComplete="username"
                  value={form.adminEmail}
                  onChange={(e) => updateField("adminEmail", e.target.value)}
                  placeholder="you@example.com"
                  error={Boolean(errors.adminEmail)}
                  disabled={saving}
                />
                {fieldError(errors.adminEmail)}
              </div>

              <div>
                <Label>
                  Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    disabled={saving}
                    className={`h-11 w-full appearance-none rounded-lg border bg-transparent px-4 py-2.5 pr-12 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 ${
                      errors.password
                        ? "border-red-500 focus:border-red-400 focus:ring-red-500/20"
                        : "border-gray-300"
                    } ${saving ? "cursor-not-allowed opacity-40" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 z-30 -translate-y-1/2 text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                    )}
                  </button>
                </div>
                {fieldError(errors.password)}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-[#0d3532] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 transition hover:bg-[#134E4A] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Prefer to sign in?{" "}
            <Link
              to="/signin"
              className="font-semibold text-teal-800 hover:underline dark:text-teal-300"
            >
              Sign in
            </Link>
            {" · "}
            <Link
              to="/partner"
              className="font-semibold text-teal-800 hover:underline dark:text-teal-300"
            >
              Back
            </Link>
          </p>
        </div>
      </AuthLayout>
    </>
  );
}
