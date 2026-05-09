import { useQuery } from "@tanstack/react-query";
import { fetchVisitTypeOptions } from "../../lib/mobile-data";
import { mobileQueryKeys } from "./query-keys";

// Cache duration constants - visit types rarely change
const CACHE_STALE_TIME = 5 * 60_000; // 5 minutes

export function useVisitTypeOptionsData(activeOnly = true) {
  return useQuery({
    queryKey: [...mobileQueryKeys.visitTypes, activeOnly ? "active" : "all"],
    queryFn: () => fetchVisitTypeOptions(activeOnly),
    staleTime: CACHE_STALE_TIME,
    gcTime: 30 * 60_000, // 30 minutes
  });
}
