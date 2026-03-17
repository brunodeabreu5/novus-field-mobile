import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAlerts,
  fetchVendorRouteHistory,
  fetchLatestVendorPositions,
  fetchVendorProfiles,
} from '../../lib/mobile-data';
import { mobileQueryKeys } from './query-keys';

export function useAlertsData(userId?: string) {
  return useQuery({
    queryKey: userId ? mobileQueryKeys.alerts(userId) : ['alerts', 'anonymous'],
    queryFn: () => fetchAlerts(userId!),
    enabled: !!userId,
  });
}

export function useVendorPositions(enabled = true) {
  return useQuery({
    queryKey: mobileQueryKeys.map,
    queryFn: fetchLatestVendorPositions,
    enabled,
    refetchInterval: enabled ? 15000 : false,
  });
}

export function useVendorRouteHistory(vendorId?: string, date?: string) {
  return useQuery({
    queryKey:
      vendorId && date
        ? mobileQueryKeys.vendorHistory(vendorId, date)
        : ["vendor-history", "idle"],
    queryFn: () => fetchVendorRouteHistory(vendorId!, date!),
    enabled: !!vendorId && !!date,
    refetchInterval: false,
  });
}

export function useVendorsData(enabled = true) {
  return useQuery({
    queryKey: mobileQueryKeys.vendors,
    queryFn: fetchVendorProfiles,
    enabled,
    refetchInterval: enabled ? 60000 : false,
  });
}

export function useVendorPositionsSubscription(enabled = true) {
  const queryClient = useQueryClient();
  void enabled;
  void queryClient;
}
