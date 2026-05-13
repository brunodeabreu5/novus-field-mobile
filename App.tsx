import React from "react";
import { StatusBar } from "expo-status-bar";

import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { DevicePermissionsProvider } from "./contexts/DevicePermissionsContext";
import { MenuProvider } from "./contexts/MenuContext";
import { TenantProvider, useTenant } from "./contexts/TenantContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { NetworkProvider } from "./contexts/NetworkContext";
import { useNetworkSync } from "./hooks/use-network-sync";
import { ChatPresenceProvider } from "./providers/ChatPresenceProvider";
import { ChatSocketProvider } from "./providers/ChatSocketProvider";
import { TrackingProvider } from "./providers/TrackingProvider";
import RootNavigator from "./navigation/RootNavigator";
import { colors } from "./theme/colors";
import "./lib/mobile-notifications";
import { initNotificationSuppressListener } from "./lib/notification-suppress";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchIntervalInBackground: false,
    },
  },
});

function ThemedApp() {
  const { theme } = useTheme();
  useNetworkSync();
  return (
    <>
      <RootNavigator />
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
    </>
  );
}

function TenantBootstrapGate() {
  const { loading } = useTenant();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  if (loading || !fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <DevicePermissionsProvider>
        <MenuProvider>
          <TrackingProvider>
            <ChatPresenceProvider>
              <ChatSocketProvider>
                <ThemeProvider>
                  <ThemedApp />
                </ThemeProvider>
              </ChatSocketProvider>
            </ChatPresenceProvider>
          </TrackingProvider>
        </MenuProvider>
      </DevicePermissionsProvider>
    </AuthProvider>
  );
}

export default function App() {
  React.useEffect(() => {
    const cleanup = initNotificationSuppressListener();
    return cleanup;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NetworkProvider>
          <TenantProvider>
            <TenantBootstrapGate />
          </TenantProvider>
        </NetworkProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
