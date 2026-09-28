import { getBrokerSignInUrl } from "./brokerAuth";

/**
 * Primary marketing CTA by auth state.
 * @param {{ isAuthenticated: boolean, hasBrokerSubscription?: boolean }} auth
 */
export function getPrimaryCta(auth) {
  const { isAuthenticated, hasBrokerSubscription } = auth;

  if (hasBrokerSubscription) {
    return {
      label: "Open broker dashboard",
      href: getBrokerSignInUrl(),
      external: true,
    };
  }

  if (isAuthenticated) {
    return {
      label: "Subscribe now",
      to: "/#pricing",
    };
  }

  return {
    label: "Get Started",
    to: "/signup",
  };
}

/**
 * Secondary CTA — hidden once the user is signed in.
 * @param {{ isAuthenticated: boolean, hasBrokerSubscription?: boolean }} auth
 */
export function getSecondaryCta(auth) {
  const { isAuthenticated } = auth;

  if (isAuthenticated) {
    return null;
  }

  return {
    label: "Book a Demo",
    to: "/book-demo",
  };
}

/**
 * Footer column heading for the CTA block.
 */
export function getCtaSectionTitle(auth) {
  if (auth.hasBrokerSubscription) return "Your account";
  if (auth.isAuthenticated) return "Complete setup";
  return "Get Started";
}

/**
 * Short hero subtitle when the user is already signed in.
 */
export function getAuthenticatedHeroMessage(user) {
  if (user?.hasBrokerSubscription) {
    return "Your broker subscription is active. Open your dashboard to manage loans and lenders.";
  }
  return "You're signed in. Choose a plan below to activate your broker dashboard.";
}

/**
 * CTA for the "Built for Brokers" / dashboard preview section.
 */
export function getExploreDashboardCta(auth) {
  if (auth.hasBrokerSubscription || auth.isAuthenticated) {
    return getPrimaryCta(auth);
  }

  return {
    label: "Explore Dashboard",
    to: "/signup",
  };
}

/**
 * Where to send an already-authenticated user away from guest-only pages.
 */
export function getAuthenticatedRedirectPath(user, planState = {}) {
  if (planState.packageId) {
    return { pathname: "/subscribe", state: planState };
  }
  if (user?.hasBrokerSubscription) {
    return { pathname: "/" };
  }
  return { pathname: "/", hash: "#pricing" };
}
