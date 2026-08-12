import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAuthenticatedRedirectPath } from "../lib/authCta";

/**
 * Redirect authenticated users away from guest-only pages (login, signup).
 */
export default function useGuestRedirect() {
  const { isAuthenticated, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const packageId = location.state?.packageId;
  const redirectTo = location.state?.redirectTo;
  const planName = location.state?.planName;
  const planState = location.state;

  useEffect(() => {
    if (loading || !isAuthenticated) return;

    if (redirectTo && !packageId) {
      navigate(redirectTo, { replace: true });
      return;
    }

    const redirect = getAuthenticatedRedirectPath(user, planState || {});
    navigate(
      {
        pathname: redirect.pathname,
        ...(redirect.hash ? { hash: redirect.hash } : {}),
      },
      {
        state: redirect.state,
        replace: true,
      },
    );
  }, [loading, isAuthenticated, user, navigate, packageId, redirectTo, planName, planState]);
}
