import React, { createContext, useContext, useEffect, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { logger } from "../lib/logger";

type NetworkContextType = {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  connectionType: NetInfoState["type"] | null;
};

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  isInternetReachable: true,
  connectionType: null,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NetworkContextType>({
    isOnline: true,
    isInternetReachable: true,
    connectionType: null,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((netInfo) => {
      const isOnline =
        netInfo.isConnected === true && netInfo.isInternetReachable !== false;
      const next = {
        isOnline,
        isInternetReachable: netInfo.isInternetReachable,
        connectionType: netInfo.type,
      };
      setState(next);

      if (isOnline) {
        logger.debug("Network", `Online (${netInfo.type})`);
      } else {
        logger.debug("Network", "Offline");
      }
    });

    return unsubscribe;
  }, []);

  return (
    <NetworkContext.Provider value={state}>{children}</NetworkContext.Provider>
  );
}

export const useNetwork = () => useContext(NetworkContext);
