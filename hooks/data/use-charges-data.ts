import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCharge,
  fetchCharges,
  updateCharge,
  updateChargeStatus,
  type Charge,
} from "../../lib/mobile-data";
import { mobileQueryKeys } from "./query-keys";

// Cache duration constants
const CACHE_STALE_TIME = 60_000; // 1 minute

export function useChargesData(userId?: string) {
  return useQuery({
    queryKey: userId
      ? mobileQueryKeys.charges(userId)
      : ["charges", "anonymous"],
    queryFn: () => fetchCharges(userId!),
    enabled: !!userId,
    staleTime: CACHE_STALE_TIME,
    gcTime: 5 * 60_000,
  });
}

export function useCreateCharge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCharge,
    onError: (error) => {
      console.error("[useCreateCharge] Error creating charge:", error);
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData<Charge[]>(
        mobileQueryKeys.charges(variables.userId),
        (current = []) => {
          if (current.some((item) => item.id === result.charge.id)) {
            return current;
          }
          return [{ ...result.charge, queued: result.queued }, ...current];
        },
      );
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.dashboard(variables.userId),
      });
    },
  });
}

export function useUpdateCharge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCharge,
    onError: (error) => {
      console.error("[useUpdateCharge] Error updating charge:", error);
    },
    onSuccess: (updatedCharge, variables) => {
      queryClient.setQueryData<Charge[]>(
        mobileQueryKeys.charges(variables.userId),
        (current = []) =>
          current.map((item) =>
            item.id === updatedCharge.charge.id
              ? { ...item, ...updatedCharge.charge, queued: updatedCharge.queued }
              : item,
          ),
      );
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.dashboard(variables.userId),
      });
    },
  });
}

export function useUpdateChargeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateChargeStatus,
    onError: (error) => {
      console.error(
        "[useUpdateChargeStatus] Error updating charge status:",
        error,
      );
    },
    onSuccess: (updatedCharge, variables) => {
      queryClient.setQueryData<Charge[]>(
        mobileQueryKeys.charges(variables.userId),
        (current = []) =>
          current.map((item) =>
            item.id === updatedCharge.charge.id
              ? { ...item, ...updatedCharge.charge, queued: updatedCharge.queued }
              : item,
          ),
      );
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.dashboard(variables.userId),
      });
    },
  });
}
