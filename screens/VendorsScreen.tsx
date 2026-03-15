import React from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ManagerStackParamList } from "../navigation/types";
import { useVendorsData } from "../hooks/use-mobile-data";
import { colors } from "../theme/colors";

export default function VendorsScreen() {
  const { data: vendors = [], isLoading } = useVendorsData();
  const navigation = useNavigation<NativeStackNavigationProp<ManagerStackParamList, "Vendors">>();

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
        data={vendors}
        keyExtractor={(item) => item.user_id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("VendorDetail", { vendorId: item.user_id })}
          >
            <Text style={styles.name}>
              {item.full_name || "Sin nombre"}
            </Text>
            {item.role_title && (
              <Text style={styles.role}>{item.role_title}</Text>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>Sin vendedores</Text>
        }
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
  name: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  role: { fontSize: 14, color: colors.mutedForeground, marginTop: 4 },
  empty: { textAlign: "center", color: colors.mutedForeground, padding: 32 },
});
