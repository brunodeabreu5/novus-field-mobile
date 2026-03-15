import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useVendorPositions } from "../hooks/use-mobile-data";
import { colors } from "../theme/colors";

export default function MapScreenWeb() {
  const { data: positions = [], isLoading } = useVendorPositions();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        <Text style={styles.title}>Mapa</Text>
        <Text style={styles.subtitle}>
          El mapa con ubicaciones en tiempo real esta disponible en la app movil
          para Android e iOS.
        </Text>
        <Text style={styles.count}>{positions.length} ubicaciones registradas</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.mutedForeground,
    textAlign: "center",
    marginBottom: 16,
  },
  count: {
    fontSize: 14,
    color: colors.primary,
  },
});
