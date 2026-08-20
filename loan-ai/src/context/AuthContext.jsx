/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  clearLoanAiSession,
  fetchLoanAiMe,
  getStoredLoanAiToken,
  getStoredLoanAiUser,
  loginLoanAiUser,
  persistLoanAiSession,
  registerLoanAiUser,
} from "../lib/loanAiAuth";

const AuthContext = createContext(null);

// Retry configuration for subscription verification after checkout
const SUBSCRIPTION_VERIFY_MAX_RETRIES = 6;
const SUBSCRIPTION_VERIFY_BASE_DELAY_MS = 2000; // 2s, 4s, 8s, 16s, 32s, 64s = ~2 min total

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredLoanAiUser());
  const [token, setToken] = useState(() => getStoredLoanAiToken());
  const [loading, setLoading] = useState(Boolean(getStoredLoanAiToken()));
  const refreshInProgress = useRef(false);

  const REFRESH_MAX_RETRIES = 3;
  const REFRESH_BASE_DELAY_MS = 500;

  const sleep = useCallback((ms) => new Promise((resolve) => setTimeout(resolve, ms)), []);

  const fetchWithRetry = useCallback(async (fn, retries = REFRESH_MAX_RETRIES, baseDelay = REFRESH_BASE_DELAY_MS) => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(`[Auth] fetchLoanAiMe attempt ${attempt + 1} failed, retrying in ${delay}ms:`, err);
          await sleep(delay);
        }
      }
    }
    throw lastError;
  }, [sleep]);

  const applySession = useCallback((nextToken, nextUser) => {
    persistLoanAiSession(nextToken, nextUser);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    clearLoanAiSession();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const storedToken = getStoredLoanAiToken();
    if (!storedToken) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetchLoanAiMe(storedToken)
      .then((json) => {
        if (cancelled) return;
        applySession(storedToken, json.data);
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applySession, logout]);

  const login = useCallback(
    async (email, password) => {
      const json = await loginLoanAiUser(email, password);
      applySession(json.data.token, json.data.user);
      try {
        const me = await fetchLoanAiMe(json.data.token);
        applySession(json.data.token, me.data);
      } catch {
        /* keep login response user */
      }
      return json;
    },
    [applySession],
  );

  const register = useCallback(
    async (payload) => {
      const json = await registerLoanAiUser(payload);
      applySession(json.data.token, json.data.user);
      try {
        const me = await fetchLoanAiMe(json.data.token);
        applySession(json.data.token, me.data);
      } catch {
        /* keep register response user */
      }
      return json;
    },
    [applySession],
  );

  const refreshUser = useCallback(async () => {
    if (!token) return null;
    if (refreshInProgress.current) {
      console.log("[Auth] refreshUser already in progress, skipping duplicate call");
      return null;
    }
    refreshInProgress.current = true;
    try {
      const json = await fetchWithRetry(() => fetchLoanAiMe(token));
      setUser(json.data);
      localStorage.setItem("loan_ai_user", JSON.stringify(json.data));
      return json.data;
    } finally {
      refreshInProgress.current = false;
    }
  }, [token, fetchWithRetry]);

  /**
   * Refresh user and verify subscription is active.
   * Retries with backoff if subscription not yet active (webhook processing delay).
   * @returns {Promise<Object|null>} Updated user data or null if not authenticated
   */
  const refreshUserAndVerifySubscription = useCallback(async () => {
    if (!token) return null;
    if (refreshInProgress.current) {
      console.log("[Auth] refreshUserAndVerifySubscription already in progress, skipping duplicate call");
      return null;
    }
    refreshInProgress.current = true;

    try {
      for (let attempt = 0; attempt <= SUBSCRIPTION_VERIFY_MAX_RETRIES; attempt++) {
        const json = await fetchWithRetry(() => fetchLoanAiMe(token));
        const userData = json.data;

        // Check if subscription is active
        if (userData.hasBrokerSubscription && userData.subscribedPackageId) {
          console.log("[Auth] Subscription verified active on attempt", attempt + 1);
          setUser(userData);
          localStorage.setItem("loan_ai_user", JSON.stringify(userData));
          return userData;
        }

        console.log(`[Auth] Subscription not yet active (attempt ${attempt + 1}/${SUBSCRIPTION_VERIFY_MAX_RETRIES + 1}), hasBrokerSubscription=`, userData.hasBrokerSubscription);

        if (attempt < SUBSCRIPTION_VERIFY_MAX_RETRIES) {
          const delay = SUBSCRIPTION_VERIFY_BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(`[Auth] Waiting ${delay}ms before retry...`);
          await sleep(delay);
        }
      }

      // Final attempt - return whatever we got
      const json = await fetchWithRetry(() => fetchLoanAiMe(token));
      setUser(json.data);
      localStorage.setItem("loan_ai_user", JSON.stringify(json.data));
      return json.data;
    } finally {
      refreshInProgress.current = false;
    }
  }, [token, fetchWithRetry, sleep]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && token),
      login,
      register,
      logout,
      refreshUser,
      refreshUserAndVerifySubscription,
    }),
    [user, token, loading, login, register, logout, refreshUser, refreshUserAndVerifySubscription],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
