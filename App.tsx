import React from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { DevicePermissionsProvider } from "./contexts/DevicePermissionsContext";
import { MenuProvider } from "./contexts/MenuContext";
import { TenantProvider, useTenant } from "./contexts/TenantContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import GlobalSyncIndicator from "./components/GlobalSyncIndicator";
import { ChatPresenceProvider } from "./providers/ChatPresenceProvider";
import { TrackingProvider } from "./providers/TrackingProvider";
import RootNavigator from "./navigation/RootNavigator";
import { colors } from "./theme/colors";

const queryClient = new QueryClient();

function ThemedApp() {
  const { theme } = useTheme();
  return (
    <>
      <RootNavigator />
      <GlobalSyncIndicator />
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
    </>
  );
}

function TenantBootstrapGate() {
  const { loading } = useTenant();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
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
              <ThemeProvider>
                <ThemedApp />
              </ThemeProvider>
            </ChatPresenceProvider>
          </TrackingProvider>
        </MenuProvider>
      </DevicePermissionsProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <TenantProvider>
          <TenantBootstrapGate />
        </TenantProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
