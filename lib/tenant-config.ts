import AsyncStorage from "@react-native-async-storage/async-storage";
import { resolveBackendApiUrl, resolveBackendWsUrl, resolveControlApiUrl } from "./config";

export interface TenantRuntimeConfig {
  tenantId: string;
  slug: string;
  companyCode: string | null;
  displayName: string;
  status: "active" | "inactive" | "suspended" | "provisioning";
  apiBaseUrl: string;
  wsBaseUrl: string;
  webBaseUrl: string;
  assetsBaseUrl: string | null;
}

interface ResolveTenantPayload {
  slug?: string;
  companyCode?: string;
}

const TENANT_CONFIG_STORAGE_KEY = "tenant_runtime_config";

let tenantConfigMemory: TenantRuntimeConfig | null = null;
let tenantConfigMemoryReady = false;

export async function getTenantConfig(): Promise<TenantRuntimeConfig | null> {
  if (tenantConfigMemoryReady) {
    return tenantConfigMemory;
  }

  const raw = await AsyncStorage.getItem(TENANT_CONFIG_STORAGE_KEY);
  if (!raw) {
    tenantConfigMemory = null;
    tenantConfigMemoryReady = true;
    return null;
  }

  try {
    tenantConfigMemory = JSON.parse(raw) as TenantRuntimeConfig;
    tenantConfigMemoryReady = true;
    return tenantConfigMemory;
  } catch {
    await AsyncStorage.removeItem(TENANT_CONFIG_STORAGE_KEY);
    tenantConfigMemory = null;
    tenantConfigMemoryReady = true;
    return null;
  }
}

export async function saveTenantConfig(config: TenantRuntimeConfig) {
  tenantConfigMemory = config;
  tenantConfigMemoryReady = true;
  await AsyncStorage.setItem(TENANT_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export async function clearTenantConfig() {
  tenantConfigMemory = null;
  tenantConfigMemoryReady = true;
  await AsyncStorage.removeItem(TENANT_CONFIG_STORAGE_KEY);
}

export async function getBackendApiUrl() {
  const config = await getTenantConfig();
  return config?.apiBaseUrl || resolveBackendApiUrl();
}

export async function getBackendWsUrl() {
  const config = await getTenantConfig();
  return config?.wsBaseUrl || resolveBackendWsUrl();
}

export async function resolveTenantConfig(payload: ResolveTenantPayload) {
  const response = await fetch(`${resolveControlApiUrl()}/tenant-resolver/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(errorPayload?.message || `HTTP ${response.status}`);
  }

  return response.json() as Promise<TenantRuntimeConfig>;
}
