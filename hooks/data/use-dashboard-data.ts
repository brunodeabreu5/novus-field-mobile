import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData } from "../../lib/mobile-data";
import { mobileQueryKeys } from "./query-keys";

export function useDashboardData(userId?: string) {
  return useQuery({
    queryKey: userId ? mobileQueryKeys.dashboard(userId) : ["dashboard", "anonymous"],
    queryFn: () => fetchDashboardData(userId!),
    enabled: !!userId,
  });
}
