import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchVisitSettings,
  updateVisitSettings,
  type UpdateVisitSettingsInput,
  type VisitSettings,
} from "../../lib/mobile-data";
import { mobileQueryKeys } from "./query-keys";

export function useVisitSettingsData() {
  return useQuery({
    queryKey: mobileQueryKeys.visitSettings,
    queryFn: fetchVisitSettings,
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
