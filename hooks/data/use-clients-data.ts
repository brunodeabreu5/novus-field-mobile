import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClient,
  fetchClients,
  updateClient,
  type Client,
} from "../../lib/mobile-data";
import { mobileQueryKeys } from "./query-keys";

export function useClientsData() {
  return useQuery({
    queryKey: mobileQueryKeys.clients,
    queryFn: fetchClients,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createClient,
    onSuccess: (result, variables) => {
      queryClient.setQueryData<Client[]>(mobileQueryKeys.clients, (current = []) => {
        if (current.some((item) => item.id === result.client.id)) {
          return current;
        }
        return [result.client, ...current];
      });
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
    onSuccess: (result, variables) => {
      queryClient.setQueryData<Client[]>(mobileQueryKeys.clients, (current = []) =>
        current.map((item) => (item.id === result.client.id ? result.client : item)),
      );
      queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.dashboard(variables.userId),
      });
    },
  });
}
