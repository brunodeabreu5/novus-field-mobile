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
  ScrollView,
} from "react-native";
import { format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "../contexts/AuthContext";
import BottomSheetModal from "../components/BottomSheetModal";
import FormActions from "../components/FormActions";
import FormField from "../components/FormField";
import EmptyState from "../components/EmptyState";
import { useTheme } from "../contexts/ThemeContext";
import {
  useChargesData,
  useCreateCharge,
  useClientsData,
} from "../hooks/use-mobile-data";
import type { Charge, Client } from "../lib/mobile-data";

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  atrasado: "Atrasado",
};

const formatAmount = (value: number) => `Gs. ${value.toLocaleString("es-PY")}`;

const ChargeCard = React.memo(({ item, styles }: { item: Charge; styles: any }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Text style={styles.client}>{item.client_name}</Text>
      <View
        style={[
          styles.statusBadge,
          item.status === "pagado"
            ? styles.statusPaid
            : item.status === "atrasado"
            ? styles.statusOverdue
            : styles.statusPending,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            item.status === "pagado"
              ? styles.statusTextPaid
              : item.status === "atrasado"
              ? styles.statusTextOverdue
              : styles.statusTextPending,
          ]}
        >
          {STATUS_LABELS[item.status] || item.status}
        </Text>
      </View>
    </View>
    <Text style={styles.amount}>{formatAmount(item.amount)}</Text>
    {item.due_date ? (
      <Text style={styles.due}>
        Vence: {format(new Date(item.due_date), "dd MMM yyyy", { locale: es })}
      </Text>
    ) : null}
  </View>
));

export default function ChargesScreen() {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const { user, profile } = useAuth();
  const { data: charges = [], isLoading } = useChargesData(user?.id);
  const { data: clients = [] } = useClientsData(user?.id);
  const createChargeMutation = useCreateCharge();
  const [modalVisible, setModalVisible] = useState(false);
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    clientId: "",
    clientName: "",
    amount: "",
    dueDate: "",
    notes: "",
  });

  const filtered = useMemo(
    () =>
      charges.filter(
        (charge) =>
          !search.trim() ||
          charge.client_name.toLowerCase().includes(search.toLowerCase())
      ),
    [charges, search]
  );

  const openModal = () => {
    setForm({
      clientId: "",
      clientName: "",
      amount: "",
      dueDate: "",
      notes: "",
    });
    setModalVisible(true);
  };

  const handleSelectClient = (client: Client) => {
    setForm((current) => ({
      ...current,
      clientId: client.id,
      clientName: client.name,
    }));
    setClientPickerVisible(false);
  };

  const saveCharge = async () => {
    if (!user || !profile || !form.clientName.trim()) {
      Alert.alert("Error", "El cliente es obligatorio");
      return;
    }

    const amount = Number.parseInt(form.amount.replace(/\D/g, ""), 10);
    if (Number.isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Ingrese un monto valido");
      return;
    }

    if (form.dueDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(form.dueDate)) {
        Alert.alert(
          "Error",
          "El formato de fecha debe ser exactamente YYYY-MM-DD"
        );
        return;
      }
      const dueDate = new Date(form.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        Alert.alert("Error", "La fecha ingresada no es válida en el calendario");
        return;
      }
      const today = startOfDay(new Date());
      if (dueDate < today) {
        Alert.alert(
          "Error",
          "La fecha de vencimiento no puede ser anterior a hoy"
        );
        return;
      }
    }

    try {
      await createChargeMutation.mutateAsync({
        userId: user.id,
        vendorName: profile.full_name || user.email || "Vendedor",
        clientId: form.clientId,
        clientName: form.clientName,
        amount,
        dueDate: form.dueDate,
        notes: form.notes,
      });
      setModalVisible(false);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo crear el cobro"
      );
    }
  };

  const renderCharge = ({ item }: { item: Charge }) => (
    <ChargeCard item={item} styles={styles} />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.search}
          placeholder="Buscar por cliente..."
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
          renderItem={renderCharge}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title="Sin Cobros"
              message="Aún no se han registrado cobros. ¡Crea el primero!"
              action={{ label: "Crear Cobro", onPress: openModal }}
            />
          }
        />
      )}

      <BottomSheetModal
        visible={modalVisible}
        title="Nuevo Cobro"
        onRequestClose={() => setModalVisible(false)}
        contentStyle={styles.modal}
      >
        <ScrollView>
          <Text style={styles.label}>Cliente *</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setClientPickerVisible(true)}
          >
            <Text
              style={form.clientName ? styles.inputText : styles.placeholderText}
            >
              {form.clientName || "Seleccione un cliente"}
            </Text>
          </TouchableOpacity>
          <FormField
            label="Monto (Gs.)"
            placeholder="Ej: 150000"
            value={form.amount}
            onChangeText={(text) =>
              setForm((current) => ({
                ...current,
                amount: text.replace(/\D/g, ""),
              }))
            }
            keyboardType="number-pad"
          />
          <FormField
            label="Fecha de vencimiento (opcional)"
            placeholder="YYYY-MM-DD"
            value={form.dueDate}
            onChangeText={(text) =>
              setForm((current) => ({ ...current, dueDate: text }))
            }
          />
          <FormField
            label="Notas"
            placeholder="Notas..."
            value={form.notes}
            onChangeText={(text) =>
              setForm((current) => ({ ...current, notes: text }))
            }
            multiline
          />
          <FormActions
            isLoading={createChargeMutation.isPending}
            submitLabel="Crear Cobro"
            onCancel={() => setModalVisible(false)}
            onSubmit={saveCharge}
          />
        </ScrollView>
      </BottomSheetModal>
      <BottomSheetModal
        visible={clientPickerVisible}
        title="Seleccionar Cliente"
        onRequestClose={() => setClientPickerVisible(false)}
      >
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.clientItem}
              onPress={() => handleSelectClient(item)}
            >
              <Text style={styles.clientItemText}>{item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No hay clientes"
              message="No se encontraron clientes. Puede crear uno nuevo en la pantalla de clientes."
            />
          }
        />
      </BottomSheetModal>
    </View>
  );
}

const useStyles = (colors) =>
  useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        header: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
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
          backgroundColor: colors.background,
        },
        addBtn: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: colors.primary,
          borderRadius: 12,
        },
        addBtnText: { color: colors.primaryForeground, fontWeight: "600" },
        loader: { marginTop: 32 },
        list: { flexGrow: 1, padding: 16, paddingBottom: 32 },
        card: {
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.border,
        },
        cardHeader: { flexDirection: "row", justifyContent: "space-between" },
        client: { fontSize: 16, fontWeight: "600", color: colors.foreground },
        statusBadge: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
        },
        statusPaid: { backgroundColor: colors.successMuted },
        statusPending: { backgroundColor: colors.warningMuted },
        statusOverdue: { backgroundColor: "rgba(239,68,68,0.15)" }, // Destructive muted
        statusText: { fontSize: 12, fontWeight: "600" },
        statusTextPaid: { color: colors.success },
        statusTextPending: { color: colors.warning },
        statusTextOverdue: { color: colors.destructive },
        amount: {
          fontSize: 18,
          fontWeight: "700",
          color: colors.foreground,
          marginTop: 8,
        },
        due: { fontSize: 13, color: colors.mutedForeground, marginTop: 4 },
        modal: { maxHeight: "90%" },
        label: {
          fontSize: 14,
          fontWeight: "500",
          color: colors.foreground,
          marginBottom: 8,
        },
        input: {
          height: 48,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 16,
          marginBottom: 16,
          justifyContent: "center",
        },
        inputText: {
          fontSize: 16,
          color: colors.foreground,
        },
        placeholderText: {
          fontSize: 16,
          color: colors.mutedForeground,
        },
        clientItem: {
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        clientItemText: {
          fontSize: 16,
          color: colors.foreground,
        },
      }),
    [colors]
  );
