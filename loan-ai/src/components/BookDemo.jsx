import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
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

  const handleSubmit = async () => {
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
      <div className="min-h-screen relative bg-[#0b1020] text-white overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <AuthPageHeader />
        <div className="relative z-10 max-w-lg mx-auto px-6 py-20 text-center">
          <h1 className="text-3xl font-bold mb-4">You&apos;re all set</h1>
          <p className="text-slate-400 mb-8">
            Your broker subscription is active. Open your dashboard to manage loans and lenders.
          </p>
          <a
            href={getBrokerSignInUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full justify-center py-3 rounded-xl font-semibold bg-linear-to-r from-emerald-500 to-teal-500"
          >
            Open broker dashboard
          </a>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-4 text-sm text-blue-400 hover:underline"
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
    <div className="min-h-screen relative bg-[#0b1020] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      <div className="absolute -top-25 left-[50%] -translate-x-1/2 w-150 h-150 bg-indigo-500/20 blur-[120px] rounded-full"></div>

      <AuthPageHeader />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block px-4 py-1 mb-4 text-sm rounded-full bg-white/10 border border-white/20">
            Smart Lending Platform
          </span>

          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Book a Demo <br />
            <span className="text-blue-400">See It In Action</span>
          </h1>

          <p className="mt-5 text-slate-300">
            Discover how Loan AI automates your workflows, matches lenders instantly,
            and boosts your productivity.
          </p>

          {isAuthenticated && (
            <p className="mt-4 text-sm text-blue-300">
              Signed in as {user?.email}. Your details are pre-filled below.
            </p>
          )}

          <div className="mt-6 space-y-3 text-sm text-slate-400">
            <div>✔ Instant lender matching</div>
            <div>✔ One-click loan processing</div>
            <div>✔ Automated follow-ups</div>
            <div>✔ Real-time analytics</div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold mb-1">Schedule Your Demo</h2>
          {planState.planName && (
            <p className="text-sm text-blue-300 mb-4">
              Selected plan: <span className="font-semibold">{planState.planName}</span>
              {planState.planCode ? ` (${planState.planCode})` : ""}
            </p>
          )}
          {!planState.planName && <div className="mb-4" />}

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                placeholder="First Name *"
                value={form.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                readOnly={nameLocked && Boolean(form.firstName)}
                className="w-full rounded-xl px-4 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500 read-only:opacity-80"
              />
              <input
                placeholder="Last Name"
                value={form.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                readOnly={nameLocked && Boolean(form.lastName)}
                className="w-full rounded-xl px-4 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500 read-only:opacity-80"
              />
            </div>

            <input
              placeholder="Email *"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              readOnly={isAuthenticated && Boolean(form.email)}
              className="w-full rounded-xl px-4 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500 read-only:opacity-80"
            />
            <input
              placeholder="Phone Number"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="w-full rounded-xl px-4 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              placeholder="Company Name"
              value={form.company}
              onChange={(e) => handleChange("company", e.target.value)}
              className="w-full rounded-xl px-4 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
            />

            <textarea
              placeholder="Message"
              value={form.message}
              onChange={(e) => handleChange("message", e.target.value)}
              rows={3}
              className="w-full rounded-xl px-4 py-2 text-sm bg-white/10 border border-white/20 text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold bg-linear-to-r from-blue-500 to-indigo-500 hover:from-indigo-500 hover:to-blue-500 transition disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Book Demo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDemoPage;
