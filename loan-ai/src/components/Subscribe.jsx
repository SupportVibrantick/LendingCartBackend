import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { fetchSubscriptionPackages } from "../lib/api";
import { buildPlanCheckoutState } from "../lib/planCheckout";
import { purchaseLoanAiSubscription } from "../lib/loanAiAuth";
import { getBrokerSignInUrl } from "../lib/brokerAuth";
import AuthPageHeader from "./AuthPageHeader";
import { useAuth } from "../context/AuthContext";

function formatPrice(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export default function SubscribePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const planFromState = location.state || {};
  const { user, token, loading: authLoading, isAuthenticated, refreshUser } = useAuth();

  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [selectedPackageId, setSelectedPackageId] = useState(planFromState.packageId || "");
  const [billingCycle, setBillingCycle] = useState(planFromState.billingCycle || "MONTHLY");
  const [form, setForm] = useState({
    organizationName: "",
    organizationEmail: "",
    organizationPhone: "",
    firstName: "",
    lastName: "",
  });
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", {
        state: planFromState.packageId ? planFromState : { redirectTo: "/subscribe" },
        replace: true,
      });
    }
  }, [authLoading, isAuthenticated, navigate, planFromState]);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      firstName: prev.firstName || user.firstName || "",
      lastName: prev.lastName || user.lastName || "",
    }));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    fetchSubscriptionPackages()
      .then((data) => {
        if (!cancelled) {
          setPackages(data);
          if (!selectedPackageId && data[0]?.id) {
            setSelectedPackageId(data[0].id);
          }
        }
      })
      .catch(() => toast.error("Could not load plans"))
      .finally(() => {
        if (!cancelled) setLoadingPackages(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPackageId]);

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);
  const checkoutPreview = selectedPkg
    ? buildPlanCheckoutState(selectedPkg, billingCycle, formatPrice)
    : null;

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCompleteSubscription = async (e) => {
    e.preventDefault();
    if (!selectedPkg || !token) {
      toast.error("Please select a plan");
      return;
    }
    if (!form.organizationName.trim() || !form.organizationEmail.includes("@")) {
      toast.error("Organization name and email are required");
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Your name is required");
      return;
    }
    const phone = form.organizationPhone.replace(/\D/g, "");
    if (!/^[0-9]{10,15}$/.test(phone)) {
      toast.error("Organization phone must be 10–15 digits");
      return;
    }
    if (user?.hasBrokerSubscription) {
      toast.error("You already have an active broker subscription");
      return;
    }

    setProcessing(true);
    try {
      await purchaseLoanAiSubscription(token, {
        packageId: selectedPkg.id,
        billingCycle,
        organizationName: form.organizationName.trim(),
        organizationEmail: form.organizationEmail.trim().toLowerCase(),
        organizationPhone: form.organizationPhone.replace(/\D/g, ""),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      });

      await refreshUser();
      setCompleted(true);
      toast.success("Subscription activated! Check your email for broker dashboard credentials.");
    } catch (err) {
      toast.error(err.message || "Subscription failed");
    } finally {
      setProcessing(false);
    }
  };

  const inputClass =
    "w-full rounded-xl px-4 py-2.5 text-sm bg-white/10 border border-white/20 text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500";

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen relative bg-[#0b1020] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute -top-25 left-1/2 -translate-x-1/2 w-150 h-150 bg-indigo-500/20 blur-[120px] rounded-full" />

      <AuthPageHeader />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Subscribe to LendingCart</h1>

        {user?.hasBrokerSubscription && !completed ? (
          <div className="space-y-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-xl">
            <p className="text-emerald-300 font-semibold text-lg">
              You already have an active subscription
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your broker dashboard is ready. Use the credentials emailed to{" "}
              <strong>{user?.email}</strong> to sign in.
            </p>
            <a
              href={getBrokerSignInUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full justify-center py-3 rounded-xl font-semibold bg-linear-to-r from-emerald-500 to-teal-500"
            >
              Open broker dashboard
            </a>
            <Link to="/" className="block text-center text-sm text-blue-400 hover:underline">
              Back to home
            </Link>
          </div>
        ) : (
          <>
        <p className="text-slate-400 mb-8 text-sm leading-relaxed">
          Complete your subscription to activate your broker account. Broker dashboard credentials
          will be sent to <strong className="text-slate-200">{user?.email}</strong> — the same email
          you use for Loan AI login.
        </p>

        {completed ? (
          <div className="space-y-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-xl">
            <p className="text-emerald-300 font-semibold text-lg">You&apos;re all set!</p>
            <p className="text-sm text-slate-300 leading-relaxed">
              We emailed broker dashboard login credentials to <strong>{user?.email}</strong>. Use
              that email with the temporary password from the email — it is separate from your Loan
              AI password.
            </p>
            <a
              href={getBrokerSignInUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full justify-center py-3 rounded-xl font-semibold bg-linear-to-r from-blue-500 to-indigo-500"
            >
              Open broker dashboard
            </a>
            <Link to="/#pricing" className="block text-center text-sm text-blue-400 hover:underline">
              Back to pricing
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleCompleteSubscription}
            className="space-y-5 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl"
          >
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">Plan</label>
              <select
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
                disabled={loadingPackages}
                className={inputClass}
              >
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id} className="text-slate-900">
                    {pkg.name} ({pkg.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              {["MONTHLY", "YEARLY"].map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setBillingCycle(cycle)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${
                    billingCycle === cycle
                      ? "bg-white text-[#0b1020] border-white"
                      : "border-white/20 text-slate-300"
                  }`}
                >
                  {cycle === "MONTHLY" ? "Monthly" : "Yearly"}
                </button>
              ))}
            </div>

            {checkoutPreview && (
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 px-4 py-3 text-sm">
                <span className="text-blue-200 font-semibold">{checkoutPreview.planName}</span>
                <span className="text-slate-300">
                  {" "}
                  — {checkoutPreview.planPrice}/{checkoutPreview.billingLabel}
                </span>
              </div>
            )}

            <input
              className={inputClass}
              placeholder="Organization name *"
              value={form.organizationName}
              onChange={(e) => handleChange("organizationName", e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Organization email *"
              type="email"
              value={form.organizationEmail}
              onChange={(e) => handleChange("organizationEmail", e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Organization phone *"
              value={form.organizationPhone}
              onChange={(e) => handleChange("organizationPhone", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className={inputClass}
                placeholder="First name *"
                value={form.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Last name *"
                value={form.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">
                Broker login email (from your Loan AI account)
              </label>
              <input
                className={`${inputClass} opacity-70 cursor-not-allowed`}
                type="email"
                value={user?.email || ""}
                readOnly
                disabled
              />
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-xs text-amber-100/90 leading-relaxed">
              Payment gateway integration is coming soon. For now, completing this form activates
              your subscription and emails broker dashboard credentials to {user?.email}.
            </div>

            <button
              type="submit"
              disabled={processing || user?.hasBrokerSubscription}
              className="w-full py-3 rounded-xl font-semibold bg-linear-to-r from-blue-500 to-indigo-500 disabled:opacity-60"
            >
              {processing
                ? "Activating..."
                : user?.hasBrokerSubscription
                  ? "Already subscribed"
                  : "Complete subscription"}
            </button>
          </form>
        )}
          </>
        )}
      </div>
    </div>
  );
}
