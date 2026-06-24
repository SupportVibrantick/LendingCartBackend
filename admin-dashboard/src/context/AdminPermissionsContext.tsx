import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  canAccessPath,
  clearAdminPermissionSession,
  hasPermission,
  loadAdminPermissionSession,
  saveAdminPermissionSession,
  type PermissionKey,
} from "../lib/adminPermissions";
import { ADMIN_API_BASE } from "../lib/adminApi";
import {
  clearAdminSession,
  handleAdminUnauthorized,
  isAdminTokenExpired,
} from "../lib/adminSession";

type AdminPermissionsContextValue = {
  permissions: PermissionKey[];
  hasFullAccess: boolean;
  loading: boolean;
  canAccess: (path: string) => boolean;
  can: (permission: PermissionKey | PermissionKey[] | null) => boolean;
  refreshPermissions: () => Promise<void>;
};

const AdminPermissionsContext = createContext<AdminPermissionsContextValue | null>(null);

export function AdminPermissionsProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [hasFullAccess, setHasFullAccess] = useState(true);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((perms: PermissionKey[], full: boolean) => {
    setPermissions(perms);
    setHasFullAccess(full);
    saveAdminPermissionSession(perms, full);
  }, []);

  const refreshPermissions = useCallback(async () => {
    const token = sessionStorage.getItem("admin_token");
    if (!token || isAdminTokenExpired(token)) {
      if (token) clearAdminSession();
      applySession([], false);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${ADMIN_API_BASE}/admin/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        handleAdminUnauthorized();
        applySession([], false);
        return;
      }

      if (!res.ok) {
        const cached = loadAdminPermissionSession();
        applySession(cached.permissions, cached.hasFullAccess);
        return;
      }

      const json = await res.json();
      const user = json.user;
      if (user) {
        const perms = Array.isArray(user.permissions) ? user.permissions : [];
        const full = Boolean(user.hasFullAccess);
        applySession(perms, full);

        const existingRaw = sessionStorage.getItem("admin_user");
        const existing = existingRaw ? JSON.parse(existingRaw) : {};
        sessionStorage.setItem(
          "admin_user",
          JSON.stringify({ ...existing, ...user, permissions: perms, hasFullAccess: full }),
        );
      }
    } catch {
      const cached = loadAdminPermissionSession();
      applySession(cached.permissions, cached.hasFullAccess);
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    const cached = loadAdminPermissionSession();
    setPermissions(cached.permissions);
    setHasFullAccess(cached.hasFullAccess);
    refreshPermissions();
  }, [refreshPermissions]);

  const value = useMemo<AdminPermissionsContextValue>(
    () => ({
      permissions,
      hasFullAccess,
      loading,
      canAccess: (path: string) => canAccessPath(path, permissions, hasFullAccess),
      can: (permission) => hasPermission(permissions, permission, hasFullAccess),
      refreshPermissions,
    }),
    [permissions, hasFullAccess, loading, refreshPermissions],
  );

  return (
    <AdminPermissionsContext.Provider value={value}>
      {children}
    </AdminPermissionsContext.Provider>
  );
}

export function useAdminPermissions() {
  const ctx = useContext(AdminPermissionsContext);
  if (!ctx) {
    throw new Error("useAdminPermissions must be used within AdminPermissionsProvider");
  }
  return ctx;
}

export { clearAdminPermissionSession };
