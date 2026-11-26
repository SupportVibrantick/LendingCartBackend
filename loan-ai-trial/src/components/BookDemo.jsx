import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Check, Loader2 } from "lucide-react";
import { submitBookDemoRequest } from "../lib/api";
import AuthPageHeader from "./AuthPageHeader";
import { useAuth } from "../context/AuthContext";
import { getBrokerSignInUrl } from "../lib/brokerAuth";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  message: "",
};

const FEATURES = [
  "Instant lender matching",
  "One-click loan processing",
  "Automated follow-ups",
  "Real-time analytics",
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 read-only:cursor-default read-only:bg-slate-50 read-only:opacity-90 dark:border-white/15 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-blue-400/60 dark:read-only:bg-white/5";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400";

const BookDemoPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const planState = location.state || {};
  const { isAuthenticated, user, loading: authLoading } = useAuth();

  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    setForm((prev) => ({
      ...prev,
      firstName: prev.firstName || user.firstName || "",
      lastName: prev.lastName || user.lastName || "",
      email: prev.email || user.email || "",
    }));
  }, [authLoading, user]);

  useEffect(() => {
    if (planState.planMessage) {
      setForm((prev) => ({
        ...prev,
        message: prev.message || planState.planMessage,
      }));
    }
  }, [planState.planMessage]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!form.firstName?.trim() || !form.email?.trim()) {
      toast.error("Please fill required fields");
      return;
    }

    try {
      setLoading(true);
      const firstName = form.firstName.trim();
      const lastName = form.lastName.trim();
      const fullName = [firstName, lastName].filter(Boolean).join(" ");

      await submitBookDemoRequest({
        // fullName kept for production APIs that still require it
        fullName,
        firstName,
        lastName: lastName || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        company: form.company.trim() || undefined,
        message: form.message.trim() || undefined,
        interestedPlanCode: planState.planCode || undefined,
        interestedPlanName: planState.planName || undefined,
      });
      toast.success("Demo booked successfully! We'll be in touch soon.");
      setForm({
        ...emptyForm,
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        email: user?.email || "",
        message: planState.planMessage || "",
      });
    } catch (err) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (user?.hasBrokerSubscription) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-[#0b1020] dark:text-white">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)]" />
        <AuthPageHeader />
        <div className="relative z-10 mx-auto max-w-lg px-6 py-20 text-center">
          <h1 className="mb-4 text-3xl font-bold">You&apos;re all set</h1>
          <p className="mb-8 text-slate-600 dark:text-slate-400">
            Your broker subscription is active. Open your dashboard to manage
            loans and lenders.
          </p>
          <a
            href={getBrokerSignInUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full justify-center rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 py-3 font-semibold text-white"
          >
            Open broker dashboard
          </a>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-4 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  const nameLocked =
    isAuthenticated && Boolean(form.firstName || form.lastName);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-[#0b1020] dark:text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)]" />
      <div className="absolute -top-25 left-1/2 h-150 w-150 -translate-x-1/2 rounded-full bg-indigo-500/15 blur-[120px] dark:bg-indigo-500/20" />
      <div className="absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-blue-400/10 blur-[100px] dark:bg-blue-500/15" />

      <AuthPageHeader />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-6 py-12 md:grid-cols-2 md:gap-14 md:py-16">
        <div className="animate-[fadeInUp_0.5s_ease-out]">
          <span className="mb-4 inline-block rounded-full border border-slate-200 bg-white px-4 py-1 text-sm text-slate-600 shadow-sm dark:border-white/15 dark:bg-white/10 dark:text-slate-300">
            Smart Lending Platform
          </span>

          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Book a Demo
            <br />
            <span className="bg-linear-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
              See It In Action
            </span>
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600 dark:text-slate-300">
            Discover how Loan AI automates your workflows, matches lenders
            instantly, and boosts your productivity.
          </p>

          {isAuthenticated && (
            <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
              Signed in as {user?.email}. Your details are pre-filled below.
            </p>
          )}

          <ul className="mt-8 space-y-3">
            {FEATURES.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <form
          onSubmit={handleSubmit}
          className="animate-[fadeInUp_0.55s_ease-out] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-7 dark:border-white/10 dark:bg-white/5 dark:shadow-none"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Schedule Your Demo
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Tell us how to reach you and we&apos;ll set up a walkthrough.
          </p>

          {planState.planName ? (
            <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2.5 text-sm dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <p className="font-semibold text-indigo-700 dark:text-indigo-200">
                Selected plan: {planState.planName}
                {planState.planCode ? ` (${planState.planCode})` : ""}
              </p>
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="demo-first-name">
                  First Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="demo-first-name"
                  placeholder="Jane"
                  value={form.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  readOnly={nameLocked && Boolean(form.firstName)}
                  className={inputClass}
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="demo-last-name">
                  Last Name
                </label>
                <input
                  id="demo-last-name"
                  placeholder="Smith"
                  value={form.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  readOnly={nameLocked && Boolean(form.lastName)}
                  className={inputClass}
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="demo-email">
                Email <span className="text-rose-500">*</span>
              </label>
              <input
                id="demo-email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                readOnly={isAuthenticated && Boolean(form.email)}
                className={inputClass}
                autoComplete="email"
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="demo-phone">
                Phone Number
              </label>
              <input
                id="demo-phone"
                type="tel"
                placeholder="555-555-5555"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className={inputClass}
                autoComplete="tel"
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="demo-company">
                Company Name
              </label>
              <input
                id="demo-company"
                placeholder="Your brokerage"
                value={form.company}
                onChange={(e) => handleChange("company", e.target.value)}
                className={inputClass}
                autoComplete="organization"
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="demo-message">
                Message
              </label>
              <textarea
                id="demo-message"
                placeholder="Anything we should know before the demo?"
                value={form.message}
                onChange={(e) => handleChange("message", e.target.value)}
                rows={3}
                className={`${inputClass} min-h-[88px] resize-y`}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-500 to-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-600 hover:to-indigo-600 hover:shadow-blue-500/35 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Book Demo"
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default BookDemoPage;
