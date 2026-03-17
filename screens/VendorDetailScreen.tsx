import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { backendApi } from "../lib/backend-api";
import type { ManagerStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";

type VendorDetailRouteProp = RouteProp<ManagerStackParamList, "VendorDetail">;
type NavigationProp = NativeStackNavigationProp<ManagerStackParamList, "VendorDetail">;

export default function VendorDetailScreen() {
  const route = useRoute<VendorDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const vendorId = route.params.vendorId;

  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await backendApi.get<{
          id: string;
          full_name: string | null;
          role_title: string | null;
          phone: string | null;
          email: string;
          document: string | null;
          avatar_url: string | null;
        }>(`/admin/users/${vendorId}`);
        setVendor(data);
      } catch {
        setVendor(null);
      }
      setLoading(false);
    }
    loadData();
  }, [vendorId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!vendor) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Vendedor no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {vendor.full_name?.substring(0, 2).toUpperCase() || "V"}
          </Text>
        </View>
        <Text style={styles.name}>{vendor.full_name || "Vendedor"}</Text>
        <Text style={styles.role}>{vendor.role_title || "Sin rol definido"}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información de Contacto</Text>
        
        {vendor.phone && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color={colors.mutedForeground} />
            <Text style={styles.infoText}>{vendor.phone}</Text>
          </View>
        )}
        
        {vendor.email && (
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={colors.mutedForeground} />
            <Text style={styles.infoText}>{vendor.email}</Text>
          </View>
        )}

        {vendor.document && (
          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={20} color={colors.mutedForeground} />
            <Text style={styles.infoText}>CI: {vendor.document}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acciones</Text>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="map-outline" size={20} color={colors.primary} />
          <Text style={styles.actionText}>Ver en Mapa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
          <Text style={styles.actionText}>Enviar Mensaje</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  errorText: {
    fontSize: 16,
    color: colors.destructive,
  },
  header: {
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.foreground,
    marginBottom: 4,
  },
  role: {
    fontSize: 16,
    color: colors.mutedForeground,
  },
  section: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: colors.foreground,
    marginLeft: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryMuted,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
    marginLeft: 12,
  },
});
