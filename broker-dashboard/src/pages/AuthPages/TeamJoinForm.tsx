import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Landmark,
  Loader2,
  Mail,
  ShieldCheck,
  User,
  UserRound,
} from "lucide-react";
import toast from "react-hot-toast";
import { BROKER_API_BASE } from "../../lib/brokerApi";

type JoinRole = "LOAN_OFFICER" | "SUB_BROKER";
type AccountType = "PERSONAL" | "BUSINESS";

type Props = {
  role: JoinRole;
  loginPath: string;
  title: string;
  personalPartyLabel: string;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accountType: AccountType;
  partyName: string;
  partyAddress: string;
  partyTel: string;
  partyEmail: string;
  bankName: string;
  bankTel: string;
  accountName: string;
  accountNumber: string;
  abaRoutingNumber: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  accountType: "PERSONAL",
  partyName: "",
  partyAddress: "",
  partyTel: "",
  partyEmail: "",
  bankName: "",
  bankTel: "",
  accountName: "",
  accountNumber: "",
  abaRoutingNumber: "",
};

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";

const errorTextClass = "mt-1.5 text-xs font-medium text-red-600 dark:text-red-400";

function inputClass(hasError: boolean) {
  return `w-full rounded-xl border px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
    hasError
      ? "border-red-400 bg-red-50 text-gray-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-red-500/60 dark:bg-red-950/20 dark:text-white dark:focus:border-red-400 dark:focus:ring-red-400/20"
      : "border-gray-200 bg-gray-50 text-gray-900 focus:border-[#13538A] focus:bg-white focus:ring-2 focus:ring-[#13538A]/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-cyan-500 dark:focus:ring-cyan-500/20"
  }`;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function validateForm(
  form: FormState,
  personalPartyLabel: string,
): FormErrors {
  const errors: FormErrors = {};
  const partyLabel =
    form.accountType === "BUSINESS" ? "Business" : personalPartyLabel;

  if (!form.firstName.trim()) {
    errors.firstName = "First name is required";
  }

  if (!form.lastName.trim()) {
    errors.lastName = "Last name is required";
  }

  const email = form.email.trim();
  if (!email) {
    errors.email = "Email is required";
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "Enter a valid email address";
  }

  const phone = phoneDigits(form.phone);
  if (form.phone.trim() && phone.length !== 10) {
    errors.phone = "Enter a valid 10-digit phone number";
  }

  if (!form.partyName.trim()) {
    errors.partyName = `${partyLabel} name is required`;
  }

  if (!form.partyAddress.trim()) {
    errors.partyAddress = `${partyLabel} address is required`;
  }

  const partyTel = phoneDigits(form.partyTel);
  if (!form.partyTel.trim()) {
    errors.partyTel = `${partyLabel} telephone is required`;
  } else if (partyTel.length !== 10) {
    errors.partyTel = "Enter a valid 10-digit phone number";
  }

  const partyEmail = form.partyEmail.trim();
  if (!partyEmail) {
    errors.partyEmail = `${partyLabel} email is required`;
  } else if (!EMAIL_RE.test(partyEmail)) {
    errors.partyEmail = "Enter a valid email address";
  }

  if (!form.bankName.trim()) {
    errors.bankName = "Bank name is required";
  }

  const bankTel = phoneDigits(form.bankTel);
  if (!form.bankTel.trim()) {
    errors.bankTel = "Bank telephone is required";
  } else if (bankTel.length !== 10) {
    errors.bankTel = "Enter a valid 10-digit phone number";
  }

  if (!form.accountName.trim()) {
    errors.accountName = "Account name is required";
  }

  const accountNumber = form.accountNumber.trim();
  if (!accountNumber) {
    errors.accountNumber = "Account number is required";
  } else if (!/^\d{4,17}$/.test(accountNumber)) {
    errors.accountNumber = "Enter a valid account number (4–17 digits)";
  }

  const routing = form.abaRoutingNumber.trim();
  if (!routing) {
    errors.abaRoutingNumber = "ABA/Routing number is required";
  } else if (!/^\d{9}$/.test(routing)) {
    errors.abaRoutingNumber = "Routing number must be 9 digits";
  }

  return errors;
}

function Field({
  label,
  error,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
      {error ? <p className={errorTextClass}>{error}</p> : null}
    </div>
  );
}

function MobileBrand() {
  return (
    <div className="mb-8 flex items-center gap-3 lg:hidden">
      <img
        src="/loanAutomation.jpeg"
        alt="Loan Automation"
        className="h-12 w-12 rounded-full ring-2 ring-[#13538A]/20"
      />
      <div>
        <p className="text-lg font-bold text-[#13538A] dark:text-cyan-400">
          Loan Automation
        </p>
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
          Broker Dashboard
        </p>
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm shadow-gray-100/80 dark:border-gray-800 dark:bg-gray-900/60 dark:shadow-none sm:p-5"
    >
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A] dark:bg-cyan-500/15 dark:text-cyan-300">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </motion.section>
  );
}

export default function TeamJoinForm({
  role,
  loginPath,
  title,
  personalPartyLabel,
}: Props) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  const roleLabel =
    role === "LOAN_OFFICER" ? "Loan Officer" : "Co-Broker";

  const partySectionTitle = useMemo(() => {
    if (form.accountType === "BUSINESS") return "Business details";
    return `${personalPartyLabel.replace(/’s$|'s$/, "")} details`;
  }, [form.accountType, personalPartyLabel]);

  useEffect(() => {
    let cancelled = false;

    async function validate() {
      if (!token.trim()) {
        setValid(false);
        setValidating(false);
        return;
      }

      try {
        const res = await fetch(
          `${BROKER_API_BASE}/public/broker-team-invites/${encodeURIComponent(token)}`,
        );
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (
          !res.ok ||
          !json.success ||
          !json.data?.valid ||
          json.data.role !== role
        ) {
          setValid(false);
          return;
        }

        setValid(true);
        setOrgName(json.data.organizationName || "");
      } catch {
        if (!cancelled) setValid(false);
      } finally {
        if (!cancelled) setValidating(false);
      }
    }

    validate();
    return () => {
      cancelled = true;
    };
  }, [token, role]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      toast.error("Invite token is missing");
      return;
    }
    if (submitting) return;

    const nextErrors = validateForm(form, personalPartyLabel);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the highlighted fields");
      const firstKey = Object.keys(nextErrors)[0];
      const el = document.querySelector(`[data-field="${firstKey}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading("Creating your account...");

    try {
      const res = await fetch(
        `${BROKER_API_BASE}/public/broker-team-invites/${encodeURIComponent(token)}/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim(),
            accountType: form.accountType,
            partyName: form.partyName.trim(),
            partyAddress: form.partyAddress.trim(),
            partyTel: form.partyTel.trim(),
            partyEmail: form.partyEmail.trim().toLowerCase(),
            bankName: form.bankName.trim(),
            bankTel: form.bankTel.trim(),
            accountName: form.accountName.trim(),
            accountNumber: form.accountNumber.trim(),
            abaRoutingNumber: form.abaRoutingNumber.trim(),
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Unable to complete registration");
      }

      setComplete(true);
      toast.success(
        json.message ||
          "Account created. Check your email for temporary credentials.",
        { id: toastId },
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to complete registration";
      toast.error(message, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  if (validating) {
    return (
      <div className="w-full">
        <MobileBrand />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#13538A] dark:text-cyan-400" />
          <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
            Validating invite link…
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Hang tight while we confirm your invitation.
          </p>
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="w-full">
        <MobileBrand />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-200/80 bg-red-50/60 p-8 text-center dark:border-red-500/30 dark:bg-red-950/20"
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300">
            <AlertCircle className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Invalid or expired link
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600 dark:text-gray-400">
            This invite link is invalid or has expired. Ask your broker admin
            for a new invitation.
          </p>
        </motion.div>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="w-full">
        <MobileBrand />
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-8 text-center dark:border-emerald-500/30 dark:bg-emerald-950/20"
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            You&apos;re all set
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600 dark:text-gray-400">
            Your {roleLabel.toLowerCase()} account was created
            {orgName ? (
              <>
                {" "}
                for{" "}
                <strong className="text-gray-800 dark:text-gray-200">
                  {orgName}
                </strong>
              </>
            ) : null}
            . Check{" "}
            <strong className="text-gray-800 dark:text-gray-200">
              {form.email}
            </strong>{" "}
            for a temporary password, then sign in.
          </p>
          <Link
            to={loginPath}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#183b57] to-[#36536c] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#183b57]/25 transition hover:brightness-110"
          >
            Go to sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <MobileBrand />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#13538A]/10 px-3 py-1 text-xs font-semibold text-[#13538A] dark:bg-cyan-500/15 dark:text-cyan-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            {roleLabel} invite
          </span>
          {orgName ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <Building2 className="h-3.5 w-3.5" />
              {orgName}
            </span>
          ) : null}
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          {title}
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          Complete your profile and banking details to join
          {orgName ? ` ${orgName}` : " this broker organization"}. A temporary
          password will be emailed after you submit.
        </p>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-sky-200/80 bg-sky-50/80 px-4 py-3 dark:border-sky-500/25 dark:bg-sky-950/30">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-300" />
          <p className="text-xs leading-relaxed text-sky-900/80 dark:text-sky-100/80">
            Use a work email you can access. Sign-in credentials are sent there
            once registration succeeds.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
          <SectionCard
            icon={User}
            title="Your account"
            description="Basic contact information for your login."
            delay={0.05}
          >
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Field label="First name *" error={errors.firstName}>
                <input
                  data-field="firstName"
                  className={inputClass(Boolean(errors.firstName))}
                  value={form.firstName}
                  onChange={(e) => setField("firstName", e.target.value)}
                  placeholder="James"
                />
              </Field>
              <Field label="Last name *" error={errors.lastName}>
                <input
                  data-field="lastName"
                  className={inputClass(Boolean(errors.lastName))}
                  value={form.lastName}
                  onChange={(e) => setField("lastName", e.target.value)}
                  placeholder="Carter"
                />
              </Field>
              <Field label="Email *" error={errors.email}>
                <input
                  data-field="email"
                  type="email"
                  className={inputClass(Boolean(errors.email))}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="Phone" error={errors.phone}>
                <input
                  data-field="phone"
                  className={inputClass(Boolean(errors.phone))}
                  value={form.phone}
                  onChange={(e) => setField("phone", formatPhone(e.target.value))}
                  placeholder="555-555-5555"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            icon={UserRound}
            title="Account type"
            description="Choose how payouts and banking should be labeled."
            delay={0.1}
          >
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  {
                    type: "PERSONAL" as AccountType,
                    label: "Personal Account",
                    hint: "Individual banking profile",
                    Icon: User,
                  },
                  {
                    type: "BUSINESS" as AccountType,
                    label: "Business Account",
                    hint: "Company banking profile",
                    Icon: Building2,
                  },
                ] as const
              ).map(({ type, label, hint, Icon }) => {
                const selected = form.accountType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setField("accountType", type)}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition ${
                      selected
                        ? "border-[#13538A] bg-[#13538A]/5 shadow-sm ring-1 ring-[#13538A]/30 dark:border-cyan-400 dark:bg-cyan-500/10 dark:ring-cyan-400/30"
                        : "border-gray-200 bg-gray-50 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        selected
                          ? "bg-[#13538A] text-white dark:bg-cyan-500"
                          : "bg-white text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span
                        className={`block text-sm font-semibold ${
                          selected
                            ? "text-[#13538A] dark:text-cyan-300"
                            : "text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {label}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                        {hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            icon={Building2}
            title={partySectionTitle}
            description="Legal name and contact used on banking records."
            delay={0.15}
          >
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Field
                label={
                  form.accountType === "BUSINESS"
                    ? "Business Name *"
                    : `${personalPartyLabel} Name *`
                }
                error={errors.partyName}
              >
                <input
                  data-field="partyName"
                  className={inputClass(Boolean(errors.partyName))}
                  value={form.partyName}
                  onChange={(e) => setField("partyName", e.target.value)}
                />
              </Field>
              <Field
                label={
                  form.accountType === "BUSINESS"
                    ? "Business Address *"
                    : `${personalPartyLabel} Address *`
                }
                error={errors.partyAddress}
              >
                <input
                  data-field="partyAddress"
                  className={inputClass(Boolean(errors.partyAddress))}
                  value={form.partyAddress}
                  onChange={(e) => setField("partyAddress", e.target.value)}
                />
              </Field>
              <Field
                label={
                  form.accountType === "BUSINESS"
                    ? "Business Tel# *"
                    : `${personalPartyLabel} Tel# *`
                }
                error={errors.partyTel}
              >
                <input
                  data-field="partyTel"
                  className={inputClass(Boolean(errors.partyTel))}
                  value={form.partyTel}
                  onChange={(e) =>
                    setField("partyTel", formatPhone(e.target.value))
                  }
                  placeholder="555-555-5555"
                />
              </Field>
              <Field
                label={
                  form.accountType === "BUSINESS"
                    ? "Business Email *"
                    : `${personalPartyLabel} Email *`
                }
                error={errors.partyEmail}
              >
                <input
                  data-field="partyEmail"
                  type="email"
                  className={inputClass(Boolean(errors.partyEmail))}
                  value={form.partyEmail}
                  onChange={(e) => setField("partyEmail", e.target.value)}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            icon={Landmark}
            title="Banking information"
            description="Used for commission and payout setup. Keep this accurate."
            delay={0.2}
          >
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <Field label="Bank Name *" error={errors.bankName}>
                <input
                  data-field="bankName"
                  className={inputClass(Boolean(errors.bankName))}
                  value={form.bankName}
                  onChange={(e) => setField("bankName", e.target.value)}
                />
              </Field>
              <Field label="Bank Tel# *" error={errors.bankTel}>
                <input
                  data-field="bankTel"
                  className={inputClass(Boolean(errors.bankTel))}
                  value={form.bankTel}
                  onChange={(e) =>
                    setField("bankTel", formatPhone(e.target.value))
                  }
                  placeholder="555-555-5555"
                />
              </Field>
              <Field
                label="Account Name *"
                error={errors.accountName}
                className="col-span-2"
              >
                <input
                  data-field="accountName"
                  className={inputClass(Boolean(errors.accountName))}
                  value={form.accountName}
                  onChange={(e) => setField("accountName", e.target.value)}
                />
              </Field>
              <Field label="Account Number *" error={errors.accountNumber}>
                <input
                  data-field="accountNumber"
                  className={inputClass(Boolean(errors.accountNumber))}
                  value={form.accountNumber}
                  onChange={(e) =>
                    setField(
                      "accountNumber",
                      e.target.value.replace(/\D/g, "").slice(0, 17),
                    )
                  }
                  autoComplete="off"
                />
              </Field>
              <Field
                label="ABA/Routing Number *"
                error={errors.abaRoutingNumber}
              >
                <input
                  data-field="abaRoutingNumber"
                  className={inputClass(Boolean(errors.abaRoutingNumber))}
                  value={form.abaRoutingNumber}
                  onChange={(e) =>
                    setField(
                      "abaRoutingNumber",
                      e.target.value.replace(/\D/g, "").slice(0, 9),
                    )
                  }
                  autoComplete="off"
                />
              </Field>
            </div>
          </SectionCard>

          <div className="space-y-3 pt-1">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#183b57] to-[#36536c] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#183b57]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  Submit & create account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.button>
            <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">
              By submitting you confirm the banking details above are correct.
            </p>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
