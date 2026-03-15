import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createVisit,
  fetchVisits,
  type Visit,
  type VisitPeriod,
} from "../../lib/mobile-data";
import { mobileQueryKeys } from "./query-keys";

export function useVisitsData(userId?: string, period: VisitPeriod = "week") {
  return useQuery({
    queryKey: userId
      ? mobileQueryKeys.visits(userId, period)
      : ["visits", "anonymous", period],
    queryFn: () => fetchVisits(userId!, period),
    enabled: !!userId,
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createVisit,
    onSuccess: (result, variables) => {
      queryClient.setQueryData<Visit[]>(
        mobileQueryKeys.visits(variables.userId, "today"),
        (current = []) => {
          if (current.some((item) => item.id === result.visit.id)) {
            return current;
          }
          return [result.visit, ...current];
        }
      );
      queryClient.setQueryData<Visit[]>(
        mobileQueryKeys.visits(variables.userId, "week"),
        (current = []) => {
          if (current.some((item) => item.id === result.visit.id)) {
            return current;
          }
          return [result.visit, ...current];
        }
      );
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.dashboard(variables.userId),
      });
    },
  });
}
