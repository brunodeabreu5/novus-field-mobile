import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData } from "../../lib/mobile-data";
import { mobileQueryKeys } from "./query-keys";

// Cache duration constants
const CACHE_STALE_TIME = 60_000; // 1 minute

export function useDashboardData(userId?: string) {
  return useQuery({
    queryKey: userId
      ? mobileQueryKeys.dashboard(userId)
      : ["dashboard", "anonymous"],
    queryFn: () => fetchDashboardData(userId!),
    enabled: !!userId,
    staleTime: CACHE_STALE_TIME,
    gcTime: 5 * 60_000,
  });
}
