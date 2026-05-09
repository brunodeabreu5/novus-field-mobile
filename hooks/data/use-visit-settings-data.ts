import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchVisitSettings,
  updateVisitSettings,
  type UpdateVisitSettingsInput,
  type VisitSettings,
} from "../../lib/mobile-data";
import { mobileQueryKeys } from "./query-keys";

// Cache duration constants - visit settings rarely change
const CACHE_STALE_TIME = 5 * 60_000; // 5 minutes

export function useVisitSettingsData() {
  return useQuery({
    queryKey: mobileQueryKeys.visitSettings,
    queryFn: fetchVisitSettings,
    staleTime: CACHE_STALE_TIME,
    gcTime: 30 * 60_000, // 30 minutes
  });
}

export function useUpdateVisitSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateVisitSettingsInput) => updateVisitSettings(input),
    onSuccess: (settings: VisitSettings) => {
      queryClient.setQueryData(mobileQueryKeys.visitSettings, settings);
    },
  });
}
