import { useCallback, useEffect, useState } from "react";
import {
  applyBrokerEntitlements,
  ORG_ENTITLEMENTS_UPDATED_EVENT,
} from "./brokerPermissions";
import { getLoanOfficerToken } from "./loanOfficerApi";
import { getCoBrokerToken } from "./coBrokerPortal";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export type BrokerEntitlements = {
  features: string[];
  permissions: string[];
  loanCategories: string[];
  loanTypes: string[];
  packageCode?: string | null;
  usage?: {
    limits?: Record<string, number | null>;
    used?: Record<string, number>;
  } | null;
};

function resolveEntitlementsRequest(): {
  url: string;
  headers: HeadersInit;
} | null {
  if (typeof window === "undefined") return null;

  const brokerToken = sessionStorage.getItem("broker_token");
  const loToken = getLoanOfficerToken();
  const coBrokerToken = getCoBrokerToken();

  const path = window.location.pathname || "";
  if (path.startsWith("/loan-officer") && loToken) {
    return {
      url: `${API_BASE}/loanofficer/entitlements`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loToken}`,
      },
    };
  }
  if (path.startsWith("/sub-broker") && coBrokerToken) {
    return {
      url: `${API_BASE}/subbroker/entitlements`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${coBrokerToken}`,
      },
    };
  }
  if (brokerToken) {
    return {
      url: `${API_BASE}/broker/entitlements`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${brokerToken}`,
      },
    };
  }
  if (loToken) {
    return {
      url: `${API_BASE}/loanofficer/entitlements`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loToken}`,
      },
    };
  }
  if (coBrokerToken) {
    return {
      url: `${API_BASE}/subbroker/entitlements`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${coBrokerToken}`,
      },
    };
  }
  return null;
}

let cached: BrokerEntitlements | null = null;
let inflight: Promise<BrokerEntitlements | null> | null = null;

export function getCachedBrokerEntitlements(): BrokerEntitlements | null {
  return cached;
}

export async function fetchBrokerEntitlements(
  force = false,
): Promise<BrokerEntitlements | null> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;

  // Force refresh should wait on an in-flight request if it's already a force
  // fetch; otherwise start a new one.
  const run = async (): Promise<BrokerEntitlements | null> => {
    try {
      const req = resolveEntitlementsRequest();
      if (!req) return null;

      const res = await fetch(req.url, { headers: req.headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success || !json.data) return null;
      cached = {
        features: json.data.features || [],
        permissions: json.data.permissions || [],
        loanCategories: json.data.loanCategories || [],
        loanTypes: json.data.loanTypes || [],
        packageCode: json.data.packageCode || null,
        usage: json.data.usage || null,
      };
      applyBrokerEntitlements(cached);
      return cached;
    } catch {
      return null;
    }
  };

  if (force) {
    inflight = run().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  if (inflight) return inflight;

  inflight = run().finally(() => {
    inflight = null;
  });
  return inflight;
}

export function clearBrokerEntitlementsCache() {
  cached = null;
  inflight = null;
  applyBrokerEntitlements(null);
}

/** Prefetch org entitlements into the permission cache (call on login/shell). */
export async function hydrateOrgEntitlements(): Promise<BrokerEntitlements | null> {
  return fetchBrokerEntitlements(true);
}

export function useBrokerEntitlements() {
  const [entitlements, setEntitlements] = useState<BrokerEntitlements | null>(
    () => cached,
  );
  const [loading, setLoading] = useState(() => !cached);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchBrokerEntitlements(true);
    setEntitlements(data);
    setLoading(false);
    return data;
  }, []);

  useEffect(() => {
    let alive = true;

    const syncFromCache = () => {
      if (!alive) return;
      setEntitlements(cached);
      setLoading(false);
    };

    window.addEventListener(ORG_ENTITLEMENTS_UPDATED_EVENT, syncFromCache);

    (async () => {
      const data = await fetchBrokerEntitlements();
      if (!alive) return;
      setEntitlements(data ?? cached);
      setLoading(false);
    })();

    return () => {
      alive = false;
      window.removeEventListener(ORG_ENTITLEMENTS_UPDATED_EVENT, syncFromCache);
    };
  }, []);

  return { entitlements, loading, refresh };
}
