import React from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "../contexts/AuthContext";
import { useAlertsData } from "../hooks/use-mobile-data";
import { colors } from "../theme/colors";

export default function AlertHistoryScreen() {
  const { user } = useAuth();
  const { data: alerts = [], isLoading } = useAlertsData(user?.id);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.card, !item.read && styles.cardUnread]}>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.meta}>
              {item.zone_name} | {item.vendor_name}
            </Text>
            <Text style={styles.date}>
              {format(new Date(item.created_at), "dd MMM yyyy HH:mm", {
                locale: es,
              })}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Sin alertas</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  message: { fontSize: 15, color: colors.foreground },
  meta: { fontSize: 13, color: colors.mutedForeground, marginTop: 4 },
  date: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  empty: { textAlign: "center", color: colors.mutedForeground, padding: 32 },
});
