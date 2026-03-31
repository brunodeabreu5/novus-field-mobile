import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCharge,
  fetchCharges,
  updateCharge,
  updateChargeStatus,
  type Charge,
} from "../../lib/mobile-data";
import { mobileQueryKeys } from "./query-keys";

export function useChargesData(userId?: string) {
  return useQuery({
    queryKey: userId ? mobileQueryKeys.charges(userId) : ["charges", "anonymous"],
    queryFn: () => fetchCharges(userId!),
    enabled: !!userId,
  });
}

export function useCreateCharge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCharge,
    onSuccess: (result, variables) => {
      queryClient.setQueryData<Charge[]>(
        mobileQueryKeys.charges(variables.userId),
        (current = []) => {
          if (current.some((item) => item.id === result.charge.id)) {
            return current;
          }
          return [{ ...result.charge, queued: result.queued }, ...current];
        }
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
    onSuccess: (updatedCharge, variables) => {
      queryClient.setQueryData<Charge[]>(
        mobileQueryKeys.charges(variables.userId),
        (current = []) => current.map((item) => (item.id === updatedCharge.id ? updatedCharge : item)),
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
    onSuccess: (updatedCharge, variables) => {
      queryClient.setQueryData<Charge[]>(
        mobileQueryKeys.charges(variables.userId),
        (current = []) => current.map((item) => (item.id === updatedCharge.id ? updatedCharge : item)),
      );
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.dashboard(variables.userId),
      });
    },
  });
}
