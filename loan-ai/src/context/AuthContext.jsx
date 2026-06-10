import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredLoanAiUser());
  const [token, setToken] = useState(() => getStoredLoanAiToken());
  const [loading, setLoading] = useState(Boolean(getStoredLoanAiToken()));

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
    const json = await fetchLoanAiMe(token);
    setUser(json.data);
    localStorage.setItem("loan_ai_user", JSON.stringify(json.data));
    return json.data;
  }, [token]);

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
    }),
    [user, token, loading, login, register, logout, refreshUser],
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
