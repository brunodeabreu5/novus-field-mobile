import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { DevicePermissionsProvider } from "./contexts/DevicePermissionsContext";
import { MenuProvider } from "./contexts/MenuContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { ChatPresenceProvider } from "./providers/ChatPresenceProvider";
import { TrackingProvider } from "./providers/TrackingProvider";
import RootNavigator from "./navigation/RootNavigator";

const queryClient = new QueryClient();

function ThemedApp() {
  const { theme } = useTheme();
  return (
    <>
      <RootNavigator />
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
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
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
