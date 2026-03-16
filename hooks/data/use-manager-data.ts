import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAlerts,
  fetchVendorRouteHistory,
  fetchLatestVendorPositions,
  fetchVendorProfiles,
} from '../../lib/mobile-data';
import { supabase } from '../../lib/supabase';
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
  });
}

export function useVendorsData(enabled = true) {
  return useQuery({
    queryKey: mobileQueryKeys.vendors,
    queryFn: fetchVendorProfiles,
    enabled,
  });
}

export function useVendorPositionsSubscription(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const channel = supabase
      .channel('vendor_positions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_positions',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: mobileQueryKeys.map });
          queryClient.invalidateQueries({ queryKey: ["vendor-history"] });
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [enabled, queryClient]);
}
