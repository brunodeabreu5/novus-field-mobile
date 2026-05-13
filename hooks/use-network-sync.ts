import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNetwork } from "../contexts/NetworkContext";
import { syncQueuedActions } from "../lib/sync";
import { logger } from "../lib/logger";

/**
 * Trigger sync, query invalidation, and socket reconnect when network comes back online.
 * Should be mounted once at the app root level.
 */
export function useNetworkSync() {
  const { isOnline } = useNetwork();
  const wasOnlineRef = useRef(isOnline);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOnline && !wasOnlineRef.current) {
      logger.debug("Network", "Network recovered — triggering sync + invalidation");

      // Sync offline queue immediately
      syncQueuedActions().catch(() => {});

      // Invalidate stale queries so they refetch
      queryClient.invalidateQueries().catch(() => {});
    }

    wasOnlineRef.current = isOnline;
  }, [isOnline, queryClient]);
}
