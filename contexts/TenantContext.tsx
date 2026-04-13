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
  buildResolvePayload,
  revalidateStoredTenant,
} from "../lib/tenant-bootstrap";
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

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantRuntimeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const stored = await getTenantConfig();
        const nextTenant = await revalidateStoredTenant(stored, resolveTenantConfig);

        if (stored && !nextTenant) {
          await clearTenantConfig();
        } else if (nextTenant && nextTenant !== stored) {
          await saveTenantConfig(nextTenant);
        }

        if (!cancelled) {
          setTenant(nextTenant);
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
      if (resolved.status !== "active") {
        throw new Error("A empresa informada nao esta ativa.");
      }
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
