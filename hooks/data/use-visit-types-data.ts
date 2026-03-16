import { useQuery } from "@tanstack/react-query";
import { fetchVisitTypeOptions } from "../../lib/mobile-data";
import { mobileQueryKeys } from "./query-keys";

export function useVisitTypeOptionsData(activeOnly = true) {
  return useQuery({
    queryKey: [...mobileQueryKeys.visitTypes, activeOnly ? "active" : "all"],
    queryFn: () => fetchVisitTypeOptions(activeOnly),
  });
}
