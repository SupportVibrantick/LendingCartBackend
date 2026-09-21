import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ExternalLink } from "lucide-react";
import { fetchSubscriptionPackages } from "../lib/api";
import {
  buildCheckoutSummary,
  filterAddOnsForPackage,
  getSelectedAddOns,
} from "../lib/addOnCheckout";
import { buildPlanCheckoutState } from "../lib/planCheckout";
import { startPlanCheckoutAndRedirect } from "../lib/startPlanCheckout";
import { startLoanAiFreeTrial } from "../lib/loanAiAuth";
import { getCheckoutUserMessage } from "../lib/checkoutErrors";
import { getBrokerSignInUrl } from "../lib/brokerAuth";
import AuthPageHeader from "./AuthPageHeader";
import AddOnSelector from "./AddOnSelector";
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

/** US phone display: 333-333-3333 (exactly 10 digits max). */
function formatPhoneDisplay(value) {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function digitsOnlyPhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

/**
 * Collect organization details, then either start a free trial (no payment)
 * or open GHL payment in a new tab.
 */
export default function SubscribePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const planFromState = location.state || {};
  const { user, token, loading: authLoading, isAuthenticated, refreshUser } =
    useAuth();

  const isTrialMode = planFromState.mode === "trial";
  const freeTrialDays = user?.freeTrialDays || 14;

  const [packages, setPackages] = useState([]);
  const [addOnCatalog, setAddOnCatalog] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [selectedPackageId, setSelectedPackageId] = useState(
    planFromState.packageId || "",
  );
  const [billingCycle, setBillingCycle] = useState(
    planFromState.billingCycle || "MONTHLY",
  );
  const [selectedAddOnCodes, setSelectedAddOnCodes] = useState(
    isTrialMode ? [] : planFromState.addOnCodes || [],
  );
  const [form, setForm] = useState({
    organizationName: "",
    organizationEmail: "",
    organizationPhone: "",
    firstName: "",
    lastName: "",
  });
  const [processing, setProcessing] = useState(false);
  const [trialStarted, setTrialStarted] = useState(false);

  const isOnTrial = user?.subscriptionStatus === "TRIAL";
  const isPaidActive = Boolean(user?.hasBrokerSubscription) && !isOnTrial;
  const canStartTrial =
    isTrialMode && !user?.hasBrokerSubscription && !user?.hasUsedFreeTrial;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", {
        state: planFromState.packageId
          ? planFromState
          : { redirectTo: "/subscribe" },
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
      organizationEmail: prev.organizationEmail || user.email || "",
    }));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    fetchSubscriptionPackages()
      .then(({ packages: loadedPackages, addOns: loadedAddOns }) => {
        if (!cancelled) {
          setPackages(loadedPackages);
          setAddOnCatalog(loadedAddOns || []);
          if (!selectedPackageId && loadedPackages[0]?.id) {
            setSelectedPackageId(loadedPackages[0].id);
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

  const availableAddOns = useMemo(
    () =>
      isTrialMode
        ? []
        : filterAddOnsForPackage(addOnCatalog, selectedPkg?.code),
    [addOnCatalog, selectedPkg?.code, isTrialMode],
  );

  useEffect(() => {
    if (isTrialMode) {
      setSelectedAddOnCodes([]);
      return;
    }
    const allowed = new Set(
      availableAddOns.map((a) => String(a.code).toUpperCase()),
    );
    setSelectedAddOnCodes((prev) =>
      prev.filter((code) => allowed.has(String(code).toUpperCase())),
    );
  }, [availableAddOns, isTrialMode]);

  const selectedAddOns = useMemo(
    () => getSelectedAddOns(availableAddOns, selectedAddOnCodes),
    [availableAddOns, selectedAddOnCodes],
  );

  const checkoutPreview = selectedPkg
    ? buildPlanCheckoutState(
        selectedPkg,
        billingCycle,
        formatPrice,
        isTrialMode ? [] : selectedAddOnCodes,
        { mode: isTrialMode ? "trial" : "paid" },
      )
    : null;

  const checkoutSummary = useMemo(
    () =>
      buildCheckoutSummary(
        selectedPkg,
        billingCycle,
        selectedAddOns,
        formatPrice,
      ),
    [selectedPkg, billingCycle, selectedAddOns],
  );

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePhoneChange = (value) => {
    setForm((prev) => ({
      ...prev,
      organizationPhone: formatPhoneDisplay(value),
    }));
  };

  const validateOrgForm = () => {
    if (!selectedPkg || !token) {
      toast.error("Please select a plan");
      return false;
    }
    if (!form.organizationName.trim() || form.organizationName.trim().length < 3) {
      toast.error("Organization name must be at least 3 characters");
      return false;
    }
    if (!form.organizationEmail.includes("@")) {
      toast.error("Organization email is required");
      return false;
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Your name is required");
      return false;
    }
    const phone = digitsOnlyPhone(form.organizationPhone);
    if (!/^[0-9]{10}$/.test(phone)) {
      toast.error("Enter a valid US phone number (10 digits)");
      return false;
    }
    return phone;
  };

  const handleStartTrial = async (e) => {
    e.preventDefault();
    if (!canStartTrial) {
      toast.error(
        user?.hasUsedFreeTrial
          ? "You have already used your free trial. Choose Buy now to subscribe."
          : "You already have an active subscription",
      );
      return;
    }
    const phone = validateOrgForm();
    if (!phone) return;

    setProcessing(true);
    try {
      await startLoanAiFreeTrial(token, {
        packageId: selectedPkg.id,
        billingCycle,
        organizationName: form.organizationName.trim(),
        organizationEmail: form.organizationEmail.trim().toLowerCase(),
        organizationPhone: phone,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      });
      await refreshUser?.();
      setTrialStarted(true);
      toast.success(
        `Your ${freeTrialDays}-day free trial is active. Check your email for broker login credentials.`,
      );
    } catch (err) {
      toast.error(getCheckoutUserMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteSubscription = async (e) => {
    e.preventDefault();
    if (isPaidActive) {
      toast.error("You already have an active broker subscription");
      return;
    }
    const phone = validateOrgForm();
    if (!phone) return;

    setProcessing(true);
    try {
      const { opened } = await startPlanCheckoutAndRedirect({
        token,
        packageId: selectedPkg.id,
        billingCycle,
        addOnCodes: selectedAddOnCodes,
        organizationName: form.organizationName.trim(),
        organizationEmail: form.organizationEmail.trim().toLowerCase(),
        organizationPhone: phone,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      });
      const qs = opened ? "status=pending" : "status=pending&popup=blocked";
      navigate(`/checkout/pending?${qs}`);
    } catch (err) {
      toast.error(getCheckoutUserMessage(err));
      setProcessing(false);
    }
  };

  const inputClass =
    "w-full rounded-xl px-4 py-2.5 text-sm bg-white/10 border border-white/20 text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500";

  if (authLoading || !isAuthenticated) {
    return null;
  }

  if (trialStarted || (isOnTrial && isTrialMode)) {
    return (
      <div className="min-h-screen relative bg-[#0b1020] text-white overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <AuthPageHeader />
        <div className="relative z-10 max-w-2xl mx-auto px-6 py-12">
          <div className="space-y-4 bg-sky-500/10 border border-sky-500/30 rounded-2xl p-6 backdrop-blur-xl">
            <p className="text-sky-200 font-semibold text-lg">
              Your {freeTrialDays}-day free trial is active
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              Broker dashboard credentials were sent to{" "}
              <strong>{user?.email}</strong>. Subscribe anytime before your trial
              ends to keep access.
            </p>
            <a
              href={getBrokerSignInUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full justify-center py-3 rounded-xl font-semibold bg-linear-to-r from-sky-500 to-blue-600"
            >
              Open broker dashboard
            </a>
            <Link
              to="/subscribe"
              state={{
                packageId: user?.subscribedPackageId || selectedPackageId,
                billingCycle: user?.subscribedBillingCycle || billingCycle,
                mode: "paid",
              }}
              className="inline-flex w-full justify-center py-3 rounded-xl font-semibold border border-white/20 hover:bg-white/5"
            >
              Subscribe now
            </Link>
            <Link
              to="/#pricing"
              className="block text-center text-sm text-blue-400 hover:underline"
            >
              Back to pricing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-[#0b1020] text-white overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute -top-25 left-1/2 -translate-x-1/2 w-150 h-150 bg-indigo-500/20 blur-[120px] rounded-full" />

      <AuthPageHeader />

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">
          {isTrialMode
            ? `Start your ${freeTrialDays}-day free trial`
            : isOnTrial
              ? "Subscribe to keep your access"
              : "Subscribe to Loan Automation"}
        </h1>

        {isPaidActive ? (
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
            <Link
              to="/"
              className="block text-center text-sm text-blue-400 hover:underline"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed">
              {isTrialMode ? (
                <>
                  Fill in your organization details to start your free trial —
                  no payment required. Broker dashboard credentials will be sent
                  to <strong className="text-slate-200">{user?.email}</strong>.
                </>
              ) : (
                <>
                  Fill in your organization details, then complete secure payment.
                  Payment opens in a new tab — this site stays open so you can
                  continue here. Broker dashboard credentials will be sent to{" "}
                  <strong className="text-slate-200">{user?.email}</strong>.
                </>
              )}
            </p>

            <form
              onSubmit={isTrialMode ? handleStartTrial : handleCompleteSubscription}
              className="space-y-5 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl"
            >
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  Plan
                </label>
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

              {!isTrialMode && availableAddOns.length > 0 && (
                <AddOnSelector
                  addOns={availableAddOns}
                  selectedCodes={selectedAddOnCodes}
                  onChange={setSelectedAddOnCodes}
                  formatPrice={formatPrice}
                  billingCycle={billingCycle}
                  compact
                />
              )}

              {isTrialMode ? (
                <div className="rounded-xl bg-sky-500/10 border border-sky-500/30 px-4 py-3 text-sm space-y-1">
                  <p className="text-sky-200 font-semibold">
                    {checkoutPreview?.planName} — {freeTrialDays}-day free trial
                  </p>
                  <p className="text-slate-300">
                    $0 due today. After the trial, billing is{" "}
                    {checkoutPreview?.planPrice}/
                    {checkoutPreview?.billingLabel} unless you cancel.
                  </p>
                </div>
              ) : (
                checkoutSummary && (
                  <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 px-4 py-3 text-sm space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-blue-200 font-semibold">
                        {checkoutPreview?.planName} plan
                      </span>
                      <span className="text-slate-200">
                        {checkoutSummary.planPrice}/{checkoutSummary.billingLabel}
                      </span>
                    </div>
                    {selectedAddOns.length > 0 && (
                      <>
                        {selectedAddOns.map((addOn) => {
                        const qty = Math.max(1, Number(addOn.quantity) || 1);
                        const unit =
                          billingCycle === "YEARLY"
                            ? Number(addOn.priceMonthly) * 12
                            : Number(addOn.priceMonthly);
                        const label =
                          String(addOn.code).toUpperCase() === "EXTRA_USER"
                            ? qty > 1
                              ? `Additional Users × ${qty}`
                              : "Additional Users"
                            : addOn.name;
                        return (
                          <div
                            key={addOn.code}
                            className="flex items-center justify-between gap-3 text-slate-300"
                          >
                            <span>{label}</span>
                            <span>
                              +{formatPrice(unit * qty)}/
                              {checkoutSummary.billingLabel}
                            </span>
                          </div>
                        );
                      })}
                        <div className="border-t border-blue-500/20 pt-2 flex items-center justify-between gap-3 font-semibold text-white">
                          <span>Total due today</span>
                          <span>
                            {checkoutSummary.totalPrice}/
                            {checkoutSummary.billingLabel}
                          </span>
                        </div>
                      </>
                    )}
                    {selectedAddOns.length === 0 && checkoutPreview && (
                      <p className="text-slate-300">
                        {checkoutPreview.planPrice}/{checkoutPreview.billingLabel}
                      </p>
                    )}
                  </div>
                )
              )}

              <input
                className={inputClass}
                placeholder="Organization name *"
                value={form.organizationName}
                onChange={(e) => handleChange("organizationName", e.target.value)}
                required
              />
              <input
                className={inputClass}
                placeholder="Organization email *"
                type="email"
                value={form.organizationEmail}
                onChange={(e) =>
                  handleChange("organizationEmail", e.target.value)
                }
                required
              />
              <input
                className={inputClass}
                placeholder="Phone * (333-333-3333)"
                inputMode="tel"
                autoComplete="tel"
                maxLength={12}
                value={form.organizationPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className={inputClass}
                  placeholder="First name *"
                  value={form.firstName}
                  onChange={(e) => handleChange("firstName", e.target.value)}
                  required
                />
                <input
                  className={inputClass}
                  placeholder="Last name *"
                  value={form.lastName}
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  required
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

              <div
                className={`rounded-xl px-4 py-3 text-xs leading-relaxed ${
                  isTrialMode
                    ? "bg-sky-500/10 border border-sky-500/30 text-sky-100/90"
                    : "bg-blue-500/10 border border-blue-500/30 text-blue-100/90"
                }`}
              >
                {isTrialMode ? (
                  <>
                    No payment today. We&apos;ll create your broker account and
                    email login credentials to {user?.email}. One free trial per
                    account.
                  </>
                ) : (
                  <>
                    Next step opens secure payment in a new tab. Keep this browser
                    open — after payment we activate your plan and email broker
                    dashboard credentials to {user?.email}.
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  processing ||
                  isPaidActive ||
                  (isTrialMode && !canStartTrial)
                }
                className={`inline-flex w-full items-center justify-center gap-2 py-3 rounded-xl font-semibold disabled:opacity-60 ${
                  isTrialMode
                    ? "bg-linear-to-r from-sky-500 to-blue-600"
                    : "bg-linear-to-r from-blue-500 to-indigo-500"
                }`}
              >
                {processing ? (
                  isTrialMode ? "Starting trial…" : "Opening payment…"
                ) : isTrialMode ? (
                  `Start ${freeTrialDays}-day free trial`
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    {checkoutSummary && selectedAddOns.length > 0
                      ? `Continue to payment — ${checkoutSummary.totalPrice}`
                      : "Continue to payment"}
                  </>
                )}
              </button>

              {isTrialMode && (
                <Link
                  to="/subscribe"
                  state={{
                    ...planFromState,
                    mode: "paid",
                    packageId: selectedPackageId,
                    billingCycle,
                  }}
                  className="block text-center text-sm text-slate-400 hover:text-white"
                >
                  Prefer to pay now? Subscribe instead
                </Link>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
