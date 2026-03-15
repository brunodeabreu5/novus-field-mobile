import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAlerts,
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

export function useVendorPositions() {
  return useQuery({
    queryKey: mobileQueryKeys.map,
    queryFn: fetchLatestVendorPositions,
  });
}

export function useVendorsData() {
  return useQuery({
    queryKey: mobileQueryKeys.vendors,
    queryFn: fetchVendorProfiles,
  });
}

export function useVendorPositionsSubscription() {
  const queryClient = useQueryClient();

  useEffect(() => {
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
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);
}
