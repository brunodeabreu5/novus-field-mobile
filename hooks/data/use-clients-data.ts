import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClient,
  fetchClients,
  updateClient,
  type Client,
} from "../../lib/mobile-data";
import { mobileQueryKeys } from "./query-keys";

// Cache duration constants (in milliseconds)
const CACHE_STALE_TIME = 60_000; // 1 minute stale time for better performance

export function useClientsData() {
  return useQuery({
    queryKey: mobileQueryKeys.clients,
    queryFn: fetchClients,
    staleTime: CACHE_STALE_TIME,
    gcTime: 5 * 60_000, // 5 minutes garbage collection time
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createClient,
    onError: (error) => {
      console.error("[useCreateClient] Error creating client:", error);
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData<Client[]>(
        mobileQueryKeys.clients,
        (current = []) => {
          if (current.some((item) => item.id === result.client.id)) {
            return current;
          }
          return [{ ...result.client, queued: result.queued }, ...current];
        },
      );
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.dashboard(variables.userId),
      });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateClient,
    onError: (error) => {
      console.error("[useUpdateClient] Error updating client:", error);
    },
    onSuccess: (result, variables) => {
      queryClient.setQueryData<Client[]>(
        mobileQueryKeys.clients,
        (current = []) =>
          current.map((item) =>
            item.id === result.client.id
              ? { ...result.client, queued: result.queued }
              : item,
          ),
      );
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.dashboard(variables.userId),
      });
    },
  });
}
