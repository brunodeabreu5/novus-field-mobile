import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useClientsData, useCreateClient } from "../hooks/use-mobile-data";
import type { Client } from "../lib/mobile-data";
import BottomSheetModal from "../components/BottomSheetModal";
import FormActions from "../components/FormActions";
import FormField from "../components/FormField";
import { colors } from "../theme/colors";

const isValidEmail = (email: string): boolean => {
  if (!email.trim()) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhone = (phone: string): boolean => {
  if (!phone.trim()) return true;
  const phoneRegex = /^[\d\s+\-()]{8,20}$/;
  return phoneRegex.test(phone);
};

export default function ClientsScreen() {
  const { user } = useAuth();
  const { data: clients = [], isLoading } = useClientsData();
  const createClientMutation = useCreateClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  const filtered = useMemo(
    () =>
      clients.filter(
        (client) =>
          !search.trim() ||
          client.name.toLowerCase().includes(search.toLowerCase()) ||
          (client.phone || "").toLowerCase().includes(search.toLowerCase()) ||
          (client.email || "").toLowerCase().includes(search.toLowerCase())
      ),
    [clients, search]
  );

  const openModal = () => {
    setForm({ name: "", phone: "", email: "", address: "", notes: "" });
    setModalVisible(true);
  };

  const handleSaveClient = async () => {
    if (!user || !form.name.trim()) {
      Alert.alert("Error", "El nombre es obligatorio");
      return;
    }

    if (!isValidEmail(form.email)) {
      Alert.alert("Error", "Formato de email invalido");
      return;
    }

    if (!isValidPhone(form.phone)) {
      Alert.alert("Error", "Formato de telefono invalido");
      return;
    }

    try {
      await createClientMutation.mutateAsync({
        userId: user.id,
        name: form.name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        notes: form.notes,
      });
      setModalVisible(false);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo guardar el cliente"
      );
    }
  };

  const renderClient = ({ item }: { item: Client }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      {item.phone ? <Text style={styles.meta}>Tel: {item.phone}</Text> : null}
      {item.address ? (
        <Text style={styles.meta} numberOfLines={1}>
          Dir: {item.address}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.search}
          placeholder="Buscar clientes..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.mutedForeground}
        />
        <TouchableOpacity style={styles.addBtn} onPress={openModal}>
          <Text style={styles.addBtnText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderClient}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Sin clientes</Text>}
        />
      )}

      <BottomSheetModal
        visible={modalVisible}
        title="Nuevo Cliente"
        onRequestClose={() => setModalVisible(false)}
        contentStyle={styles.modal}
      >
        <FormField
          label="Nombre *"
          placeholder="Nombre del cliente"
          value={form.name}
          onChangeText={(text) => setForm((current) => ({ ...current, name: text }))}
        />
        <FormField
          label="Telefono"
          placeholder="Telefono"
          value={form.phone}
          onChangeText={(text) => setForm((current) => ({ ...current, phone: text }))}
          keyboardType="phone-pad"
        />
        <FormField
          label="Email"
          placeholder="Email"
          value={form.email}
          onChangeText={(text) => setForm((current) => ({ ...current, email: text }))}
          keyboardType="email-address"
        />
        <FormField
          label="Direccion"
          placeholder="Direccion"
          value={form.address}
          onChangeText={(text) => setForm((current) => ({ ...current, address: text }))}
        />
        <FormActions
          isLoading={createClientMutation.isPending}
          submitLabel="Guardar"
          onCancel={() => setModalVisible(false)}
          onSubmit={handleSaveClient}
        />
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  search: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.foreground,
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  addBtnText: { color: "#fff", fontWeight: "600" },
  loader: { marginTop: 32 },
  list: { padding: 16, paddingBottom: 32 },
  empty: { textAlign: "center", color: colors.mutedForeground, marginTop: 32 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  meta: { fontSize: 13, color: colors.mutedForeground, marginTop: 4 },
  modal: {
    maxHeight: "90%",
  },
});
