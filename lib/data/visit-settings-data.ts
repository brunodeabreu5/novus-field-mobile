import { backendApi } from "../backend-api";

export interface VisitSettings {
  id: string;
  min_duration_minutes: number;
  exclude_under_minutes: number | null;
  count_from_minutes: number;
  overtime_threshold_minutes: number;
  updated_at: string;
  updated_by: string;
}

export interface UpdateVisitSettingsInput {
  min_duration_minutes: number;
  exclude_under_minutes: number | null;
  count_from_minutes: number;
  overtime_threshold_minutes: number;
}

export async function fetchVisitSettings(): Promise<VisitSettings> {
  return backendApi.get<VisitSettings>("/settings/visit");
}

export async function updateVisitSettings(
  input: UpdateVisitSettingsInput,
): Promise<VisitSettings> {
  return backendApi.patch<VisitSettings>("/settings/visit", input);
}
