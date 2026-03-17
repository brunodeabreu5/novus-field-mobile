import { backendApi } from "../backend-api";
import type { Tables } from "../types";

type VisitTypeOption = Tables<"visit_type_options">;

export async function fetchVisitTypeOptions(activeOnly = true): Promise<VisitTypeOption[]> {
  const data = await backendApi.get<VisitTypeOption[]>(
    `/visit-types?activeOnly=${activeOnly ? "true" : "false"}`,
  );
  return data || [];
}

export async function fetchDefaultVisitTypeName(): Promise<string> {
  const types = await fetchVisitTypeOptions(true);
  return types.find((item) => item.is_default)?.name || types[0]?.name || "Comercial";
}
