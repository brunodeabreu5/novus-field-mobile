import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ManagerStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { spacing, fontSize, radius } from "../theme/spacing";

const CARDS = [
  {
    title: "Mapa",
    description: "Ver ubicaciones y replay historico de vendedores",
    route: "Map",
  },
  {
    title: "Vendedores",
    description: "Lista de vendedores",
    route: "Vendors",
  },
  {
    title: "Alertas",
    description: "Historial de alertas de geofence",
    route: "Alerts",
  },
  {
    title: "Config. Alertas",
    description: "Configurar alertas de desvío y falta de movimiento",
    route: "AlertConfig",
  },
  {
    title: "Config. Visitas",
    description: "Configurar reglas obligatorias en las visitas",
    route: "VisitSettings",
  },
  {
    title: "Reportes",
    description: "Revisar rendimiento, cobertura y analisis comercial",
    route: "Reports",
  },
] as const;

export default function ManagerHomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ManagerStackParamList, "ManagerHome">>();

  return (
    <View style={styles.container}>
      {CARDS.map((card) => (
        <TouchableOpacity
          key={card.route}
          style={styles.card}
          onPress={() => navigation.navigate(card.route)}
        >
          <Text style={styles.title}>{card.title}</Text>
          <Text style={styles.desc}>{card.description}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = spacing; const f = fontSize; const r = radius;

const styles = StyleSheet.create({
  container: { flex: 1, padding: s.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: r.lg,
    padding: s.lg,
    marginBottom: s.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: f.lg, fontWeight: "700", color: colors.foreground },
  desc: { fontSize: f.base, color: colors.mutedForeground, marginTop: 4 },
});
