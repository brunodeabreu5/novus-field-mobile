import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  checkoutVisit,
  createVisit,
  fetchVisits,
  type VisitRecord,
  type VisitPeriod,
} from "../../lib/mobile-data";
import { mobileQueryKeys } from "./query-keys";

// Cache duration constants
const CACHE_STALE_TIME = 60_000; // 1 minute

export function useVisitsData(userId?: string, period: VisitPeriod = "week") {
  return useQuery({
    queryKey: userId
      ? mobileQueryKeys.visits(userId, period)
      : ["visits", "anonymous", period],
    queryFn: () => fetchVisits(userId!, period),
    enabled: !!userId,
    staleTime: CACHE_STALE_TIME,
    gcTime: 5 * 60_000,
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createVisit,
    onError: (error, variables) => {
      // Error is already handled with user-friendly message in the API call
      console.error("[useCreateVisit] Error creating visit:", error);
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData<VisitRecord[]>(
        mobileQueryKeys.visits(variables.userId, "today"),
        (current = []) => {
          if (current.some((item) => item.id === result.visit.id)) {
            return current;
          }
          return [{ ...result.visit, queued: result.queued }, ...current];
        },
      );
      queryClient.setQueryData<VisitRecord[]>(
        mobileQueryKeys.visits(variables.userId, "week"),
        (current = []) => {
          if (current.some((item) => item.id === result.visit.id)) {
            return current;
          }
          return [{ ...result.visit, queued: result.queued }, ...current];
        },
      );
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.dashboard(variables.userId),
      });
    },
  });
}

export function useCheckoutVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: checkoutVisit,
    onError: (error) => {
      console.error("[useCheckoutVisit] Error checking out:", error);
    },
    onSuccess: (result, variables) => {
      const applyVisitUpdate = (current: VisitRecord[] = []) =>
        current.map((item) =>
          item.id === variables.visitId
            ? {
                ...item,
                check_out_at: result.visit.check_out_at,
                check_out_lat: result.visit.check_out_lat,
                check_out_lng: result.visit.check_out_lng,
                pending_checkout: result.queued,
              }
            : item,
        );

      queryClient.setQueryData<VisitRecord[]>(
        mobileQueryKeys.visits(variables.userId, "today"),
        applyVisitUpdate,
      );
      queryClient.setQueryData<VisitRecord[]>(
        mobileQueryKeys.visits(variables.userId, "week"),
        applyVisitUpdate,
      );
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.dashboard(variables.userId),
      });
    },
  });
}
