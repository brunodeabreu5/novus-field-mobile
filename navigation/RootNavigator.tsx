import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
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
});
