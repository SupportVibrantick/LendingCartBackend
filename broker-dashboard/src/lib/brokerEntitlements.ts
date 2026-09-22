import { useCallback, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export type BrokerEntitlements = {
  features: string[];
  permissions: string[];
  loanCategories: string[];
  loanTypes: string[];
  packageCode?: string | null;
};

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

let cached: BrokerEntitlements | null = null;
let inflight: Promise<BrokerEntitlements | null> | null = null;

export async function fetchBrokerEntitlements(
  force = false,
): Promise<BrokerEntitlements | null> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/broker/entitlements`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!json?.success || !json.data) return null;
      cached = {
        features: json.data.features || [],
        permissions: json.data.permissions || [],
        loanCategories: json.data.loanCategories || [],
        loanTypes: json.data.loanTypes || [],
        packageCode: json.data.packageCode || null,
      };
      return cached;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function clearBrokerEntitlementsCache() {
  cached = null;
  inflight = null;
}

export function useBrokerEntitlements() {
  const [entitlements, setEntitlements] = useState<BrokerEntitlements | null>(cached);
  const [loading, setLoading] = useState(!cached);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchBrokerEntitlements(true);
    setEntitlements(data);
    setLoading(false);
    return data;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await fetchBrokerEntitlements();
      if (!alive) return;
      setEntitlements(data);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { entitlements, loading, refresh };
}
