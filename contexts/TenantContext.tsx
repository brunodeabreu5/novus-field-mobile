import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clearStoredAuthState } from "../lib/backend-auth";
import {
  clearTenantConfig,
  getTenantConfig,
  resolveTenantConfig,
  saveTenantConfig,
  type TenantRuntimeConfig,
} from "../lib/tenant-config";

interface TenantContextType {
  tenant: TenantRuntimeConfig | null;
  loading: boolean;
  configured: boolean;
  resolveTenant: (identifier: string) => Promise<void>;
  clearTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

function buildResolvePayload(identifier: string) {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new Error("Informe o codigo ou slug da empresa");
  }

  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
    return { slug: trimmed.toLowerCase() };
  }

  return { companyCode: trimmed.toUpperCase() };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantRuntimeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const stored = await getTenantConfig();
        if (!cancelled) {
          setTenant(stored);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<TenantContextType>(() => ({
    tenant,
    loading,
    configured: !!tenant,
    async resolveTenant(identifier: string) {
      const payload = buildResolvePayload(identifier);
      const resolved = await resolveTenantConfig(payload);
      await saveTenantConfig(resolved);
      await clearStoredAuthState();
      setTenant(resolved);
    },
    async clearTenant() {
      await clearStoredAuthState();
      await clearTenantConfig();
      setTenant(null);
    },
  }), [loading, tenant]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within TenantProvider");
  }

  return context;
}
