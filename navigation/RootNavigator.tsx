import React, { useCallback, useEffect, useRef } from "react";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useAuth } from "../contexts/AuthContext";
import MenuButton from "../components/MenuButton";
import DrawerMenu from "../components/DrawerMenu";
import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import VisitsScreen from "../screens/VisitsScreen";
import ClientsScreen from "../screens/ClientsScreen";
import ChargesScreen from "../screens/ChargesScreen";
import ChatScreen from "../screens/ChatScreen";
import AccountScreen from "../screens/AccountScreen";
import ManagerHomeScreen from "../screens/ManagerHomeScreen";
import MapScreen from "../screens/MapScreen";
import VendorsScreen from "../screens/VendorsScreen";
import VendorDetailScreen from "../screens/VendorDetailScreen";
import AlertHistoryScreen from "../screens/AlertHistoryScreen";
import AlertConfigScreen from "../screens/AlertConfigScreen";
import VisitSettingsScreen from "../screens/VisitSettingsScreen";
import type { MainTabParamList, ManagerStackParamList, RootStackParamList } from "./types";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function BiometricLockScreen() {
  const { biometricLabel, biometricUnlocking, signOut, unlockWithBiometrics } = useAuth();

  return (
    <View style={styles.lockScreen}>
      <Text style={styles.lockTitle}>Autenticacion biometrica</Text>
      <Text style={styles.lockDescription}>
        Use {biometricLabel} para desbloquear el acceso a la sesion guardada en este
        dispositivo.
      </Text>
      <TouchableOpacity
        style={[styles.lockButton, biometricUnlocking && styles.lockButtonDisabled]}
        onPress={unlockWithBiometrics}
        disabled={biometricUnlocking}
      >
        {biometricUnlocking ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={styles.lockButtonText}>Desbloquear con {biometricLabel}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={signOut}>
        <Text style={styles.lockSignOut}>Cerrar sesion</Text>
      </TouchableOpacity>
    </View>
  );
}

function MainTabs() {
  const { isManagerOrAdmin } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 8,
          minHeight: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerLeft: () => <MenuButton />,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: "Inicio",
          tabBarLabel: "Inicio",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Visits"
        component={VisitsScreen}
        options={{
          title: "Visitas",
          tabBarLabel: "Visitas",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{
          title: "Clientes",
          tabBarLabel: "Clientes",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Charges"
        component={ChargesScreen}
        options={{
          title: "Cobros",
          tabBarLabel: "Cobros",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: "Chat",
          tabBarLabel: "Chat",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      {isManagerOrAdmin ? (
        <Tab.Screen
          name="Manager"
          component={ManagerStackScreen}
          options={{
            title: "Manager",
            tabBarLabel: "Manager",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" size={size} color={color} />
            ),
          }}
        />
      ) : null}
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        options={{
          title: "Mi Cuenta",
          tabBarLabel: "Cuenta",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const ManagerStack = createNativeStackNavigator<ManagerStackParamList>();

function ManagerStackScreen() {
  return (
    <ManagerStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
      }}
    >
      <ManagerStack.Screen
        name="ManagerHome"
        component={ManagerHomeScreen}
        options={{
          title: "Manager",
          headerLeft: () => <MenuButton />,
        }}
      />
      <ManagerStack.Screen
        name="Map"
        component={MapScreen}
        options={{ title: "Mapa de vendedores" }}
      />
      <ManagerStack.Screen
        name="Vendors"
        component={VendorsScreen}
        options={{ title: "Vendedores" }}
      />
      <ManagerStack.Screen
        name="VendorDetail"
        component={VendorDetailScreen}
        options={{ title: "Detalle del Vendedor" }}
      />
      <ManagerStack.Screen
        name="Alerts"
        component={AlertHistoryScreen}
        options={{ title: "Historial de alertas" }}
      />
      <ManagerStack.Screen
        name="AlertConfig"
        component={AlertConfigScreen}
        options={{ title: "Config. de alertas" }}
      />
      <ManagerStack.Screen
        name="VisitSettings"
        component={VisitSettingsScreen}
        options={{ title: "Config. de visitas" }}
      />
    </ManagerStack.Navigator>
  );
}

export default function RootNavigator() {
  const { session, loading, biometricLoading, biometricRequired } = useAuth();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const pendingContactIdRef = useRef<string | null>(null);

  const navigateToChatNotification = useCallback(
    (contactId?: string | null) => {
      if (!contactId) return;

      if (!navigationRef.isReady()) {
        pendingContactIdRef.current = contactId;
        return;
      }

      navigationRef.navigate("Main", {
        screen: "Chat",
        params: { contactId },
      });
    },
    [navigationRef]
  );

  const handleNotificationData = useCallback(
    (data: Record<string, unknown> | undefined) => {
      if (data?.type !== "chat") {
        return;
      }

      const contactId =
        typeof data.contactId === "string"
          ? data.contactId
          : typeof data.senderId === "string"
            ? data.senderId
            : null;

      navigateToChatNotification(contactId);
    },
    [navigateToChatNotification]
  );

  useEffect(() => {
    if (!session) {
      pendingContactIdRef.current = null;
      return;
    }

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      if (data?.type === "chat") {
        console.log("Received chat notification", data);
      }
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationData(
        response.notification.request.content.data as Record<string, unknown> | undefined
      );
    });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleNotificationData(
            response.notification.request.content.data as Record<string, unknown> | undefined
          );
        }
      })
      .catch((error) => {
        console.error("Failed to recover last mobile notification response", error);
      });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [handleNotificationData, session]);

  if (loading || biometricLoading) {
    return <LoadingScreen />;
  }

  if (session && biometricRequired) {
    return <BiometricLockScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (pendingContactIdRef.current) {
          const contactId = pendingContactIdRef.current;
          pendingContactIdRef.current = null;
          navigateToChatNotification(contactId);
        }
      }}
    >
      {session ? (
        <>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main" component={MainTabs} />
          </Stack.Navigator>
          <DrawerMenu />
        </>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login">
            {() => <LoginScreen onSuccess={() => {}} />}
          </Stack.Screen>
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  lockScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  lockTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 12,
  },
  lockDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: colors.mutedForeground,
    marginBottom: 24,
    maxWidth: 320,
  },
  lockButton: {
    minWidth: 260,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    marginBottom: 16,
  },
  lockButtonDisabled: {
    opacity: 0.7,
  },
  lockButtonText: {
    color: colors.primaryForeground,
    fontSize: 16,
    fontWeight: "600",
  },
  lockSignOut: {
    color: colors.destructive,
    fontSize: 15,
    fontWeight: "600",
  },
});
