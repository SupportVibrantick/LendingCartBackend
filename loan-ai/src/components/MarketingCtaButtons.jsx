import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPrimaryCta, getSecondaryCta } from "../lib/authCta";

const primaryClass =
  "bg-linear-to-r from-blue-500 to-indigo-500 px-8 py-3 rounded-xl font-semibold shadow-lg hover:scale-105 hover:shadow-blue-500/30 transition inline-block text-center text-white";

const secondaryClass =
  "bg-white/10 border border-white/20 px-8 py-3 rounded-xl font-semibold backdrop-blur-md hover:bg-white/20 transition inline-block text-center text-white";

const compactPrimaryClass =
  "w-full text-center bg-linear-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-xl font-semibold shadow-lg hover:scale-[1.02] hover:shadow-blue-500/30 transition";

const compactSecondaryClass =
  "w-full text-center bg-white/10 border border-white/20 text-white py-3 rounded-xl hover:bg-white/20 transition";

const subscribedPrimaryClass =
  "w-full text-center bg-linear-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-semibold shadow-lg hover:scale-[1.02] transition";

function CtaLink({ cta, className, state }) {
  if (!cta) return null;

  if (cta.external) {
    return (
      <a
        href={cta.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {cta.label}
      </a>
    );
  }

  return (
    <Link to={cta.to} state={state} className={className}>
      {cta.label}
    </Link>
  );
}

export default function MarketingCtaButtons({
  variant = "hero",
  checkoutState,
  demoState,
}) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className={
          variant === "hero"
            ? "flex justify-center gap-5"
            : "flex flex-col gap-4"
        }
      >
        <div
          className={`${variant === "hero" ? "h-12 w-40" : "h-12 w-full"} rounded-xl bg-white/10 animate-pulse`}
        />
        {variant === "hero" && (
          <div className="h-12 w-40 rounded-xl bg-white/10 animate-pulse" />
        )}
      </div>
    );
  }

  const auth = {
    isAuthenticated,
    hasBrokerSubscription: Boolean(user?.hasBrokerSubscription),
  };

  const primary = getPrimaryCta(auth);
  const secondary = getSecondaryCta(auth);

  const primaryClassName =
    variant === "footer"
      ? auth.hasBrokerSubscription
        ? subscribedPrimaryClass
        : compactPrimaryClass
      : auth.hasBrokerSubscription
        ? primaryClass.replace("from-blue-500 to-indigo-500", "from-emerald-500 to-teal-500")
        : primaryClass;

  const secondaryClassName =
    variant === "footer" ? compactSecondaryClass : secondaryClass;

  const containerClass =
    variant === "hero"
      ? "flex flex-col sm:flex-row justify-center gap-5"
      : "flex flex-col gap-4";

  return (
    <div className={containerClass}>
      <CtaLink
        cta={primary}
        className={primaryClassName}
        state={checkoutState}
      />
      {secondary && (
        <CtaLink
          cta={secondary}
          className={secondaryClassName}
          state={demoState}
        />
      )}
    </div>
  );
}
