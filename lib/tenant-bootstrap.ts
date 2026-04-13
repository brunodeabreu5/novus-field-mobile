import type { TenantRuntimeConfig } from "./tenant-config";

type ResolveTenantPayload = {
  slug?: string;
  companyCode?: string;
};

export function buildResolvePayload(identifier: string): ResolveTenantPayload {
  const trimmed = identifier.trim();
  if (!trimmed) {
    throw new Error("Informe o codigo ou slug da empresa");
  }

  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
    return { slug: trimmed.toLowerCase() };
  }

  return { companyCode: trimmed.toUpperCase() };
}

export function buildStoredTenantPayload(
  tenant: TenantRuntimeConfig,
): ResolveTenantPayload | null {
  if (tenant.slug.trim()) {
    return { slug: tenant.slug.trim().toLowerCase() };
  }

  if (tenant.companyCode?.trim()) {
    return { companyCode: tenant.companyCode.trim().toUpperCase() };
  }

  return null;
}

export async function revalidateStoredTenant(
  tenant: TenantRuntimeConfig | null,
  resolver: (payload: ResolveTenantPayload) => Promise<TenantRuntimeConfig>,
): Promise<TenantRuntimeConfig | null> {
  if (!tenant) {
    return null;
  }

  const payload = buildStoredTenantPayload(tenant);
  if (!payload) {
    return tenant;
  }

  try {
    const resolved = await resolver(payload);
    return resolved.status === "active" ? resolved : null;
  } catch {
    return tenant;
  }
}
