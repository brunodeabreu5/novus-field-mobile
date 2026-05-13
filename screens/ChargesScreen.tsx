import React, { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { SafeAreaView } from "react-native-safe-area-context";
import {
  showError,
  showSuccess,
  showWarning,
  logError,
} from "../lib/error-handler";
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
  useUpdateCharge,
  useUpdateChargeStatus,
} from "../hooks/use-mobile-data";
import type { ChargeRecord, Client } from "../lib/mobile-data";
import type { ThemeColors } from "../theme/colors";
import { chargeSchema, type ChargeFormData } from "../lib/schemas";

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  atrasado: "Atrasado",
};

const formatAmount = (value: number) => `Gs. ${value.toLocaleString("es-PY")}`;
const normalizeClientName = (value: string) =>
  value.replace(/\s+/g, " ").trim();
const normalizeAmountInput = (value: string) => value.replace(/\D/g, "");
const normalizeDueDate = (value: string) => value.trim();
const normalizeNotes = (value: string) => value.replace(/\s+/g, " ").trim();

const ChargeCard = React.memo(
  ({
    item,
    styles,
    onEdit,
    onUpdateStatus,
  }: {
    item: ChargeRecord;
    styles: any;
    onEdit: (charge: ChargeRecord) => void;
    onUpdateStatus: (charge: ChargeRecord) => void;
  }) => (
    <View
      style={[
        styles.card,
        item.status === "atrasado" ? styles.cardOverdue : null,
        item.status === "pagado" ? styles.cardPaid : null,
        item.queued ? styles.cardQueued : null,
      ]}
    >
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
          Vence:{" "}
          {format(new Date(item.due_date), "dd MMM yyyy", { locale: es })}
        </Text>
      ) : null}
      {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
      {item.queued ? (
        <View style={styles.queueBadge}>
          <Text style={styles.queueBadgeText}>Pendiente de sync</Text>
        </View>
      ) : null}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => onEdit(item)}
        >
          <Text style={styles.secondaryButtonText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => onUpdateStatus(item)}
        >
          <Text style={styles.primaryButtonText}>Cambiar estado</Text>
        </TouchableOpacity>
      </View>
    </View>
  ),
);

export default function ChargesScreen() {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const { user, profile } = useAuth();
  const { data: charges = [], isLoading } = useChargesData(user?.id);
  const { data: clients = [] } = useClientsData();
  const createChargeMutation = useCreateCharge();
  const updateChargeMutation = useUpdateCharge();
  const updateChargeStatusMutation = useUpdateChargeStatus();
  const [modalVisible, setModalVisible] = useState(false);
  const [activePicker, setActivePicker] = useState<"client" | null>(null);
  const [search, setSearch] = useState("");
  const [editingCharge, setEditingCharge] = useState<ChargeRecord | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ChargeFormData>({
    resolver: zodResolver(chargeSchema),
    defaultValues: {
      clientId: "",
      clientName: "",
      amount: "",
      dueDate: "",
      notes: "",
    },
  });

  const clientName = watch("clientName");

  const filtered = useMemo(() => {
    const searchTerm = search.toLowerCase().trim();
    const getPriority = (charge: ChargeRecord) => {
      if (charge.queued) return 0;
      if (charge.status === "atrasado") return 1;
      if (charge.status === "pendiente") return 2;
      return 3;
    };

    return [...charges]
      .filter(
        (charge) =>
          !searchTerm || charge.client_name.toLowerCase().includes(searchTerm),
      )
      .sort((a, b) => getPriority(a) - getPriority(b));
  }, [charges, search]);

  const openModal = () => {
    setEditingCharge(null);
    reset({
      clientId: "",
      clientName: "",
      amount: "",
      dueDate: "",
      notes: "",
    });
    setActivePicker(null);
    setModalVisible(true);
  };

  const openEditModal = (charge: ChargeRecord) => {
    setEditingCharge(charge);
    reset({
      clientId: charge.client_id || "",
      clientName: charge.client_name,
      amount: String(charge.amount || ""),
      dueDate: charge.due_date ? String(charge.due_date).slice(0, 10) : "",
      notes: charge.notes || "",
    });
    setActivePicker(null);
    setModalVisible(true);
  };

  const handleSelectClient = (client: Client) => {
    setValue("clientId", client.id);
    setValue("clientName", client.name);
    setActivePicker(null);
  };

  const handleModalRequestClose = () => {
    if (activePicker) {
      setActivePicker(null);
      return;
    }

    setModalVisible(false);
    setEditingCharge(null);
  };

  const modalTitle =
    activePicker === "client"
      ? "Seleccionar Cliente"
      : editingCharge
        ? "Editar Cobro"
        : "Nuevo Cobro";

  const saveCharge = handleSubmit(async (data) => {
    if (!user || !profile) {
      Alert.alert("Error", "Usuario no autenticado");
      return;
    }

    const normalizedClientName = normalizeClientName(data.clientName);
    const normalizedAmount = normalizeAmountInput(data.amount);
    const normalizedDueDate = normalizeDueDate(data.dueDate);
    const normalizedNotes = normalizeNotes(data.notes);

    const amount = Number.parseInt(normalizedAmount, 10);

    try {
      if (editingCharge) {
        await updateChargeMutation.mutateAsync({
          userId: user.id,
          chargeId: editingCharge.id,
          clientId: data.clientId,
          clientName: normalizedClientName,
          amount,
          dueDate: normalizedDueDate,
          notes: normalizedNotes,
        });
      } else {
        await createChargeMutation.mutateAsync({
          userId: user.id,
          vendorName: profile.full_name || user.email || "Vendedor",
          clientId: data.clientId,
          clientName: normalizedClientName,
          amount,
          dueDate: normalizedDueDate,
          notes: normalizedNotes,
        });
      }
      setModalVisible(false);
      setEditingCharge(null);
      reset();
    } catch (error) {
      logError("ChargesScreen/save", error);
      showError(error, "Error al guardar cobro");
    }
  });

  const handleUpdateStatus = (charge: ChargeRecord) => {
    if (!user) {
      return;
    }

    const statusOptions = ["pendiente", "pagado", "atrasado"].filter(
      (status) => status !== charge.status,
    );

    Alert.alert(
      "Cambiar estado",
      `Estado actual: ${STATUS_LABELS[charge.status] || charge.status}`,
      [
        { text: "Cancelar", style: "cancel" },
        ...statusOptions.map((status) => ({
          text: STATUS_LABELS[status] || status,
          onPress: () => {
            void updateChargeStatusMutation
              .mutateAsync({
                userId: user.id,
                chargeId: charge.id,
                status,
              })
              .catch((error) => {
                Alert.alert(
                  "Error",
                  error instanceof Error
                    ? error.message
                    : "No se pudo actualizar el estado",
                );
              });
          },
        })),
      ],
    );
  };

  const renderCharge = ({ item }: { item: ChargeRecord }) => (
    <ChargeCard
      item={item}
      styles={styles}
      onEdit={openEditModal}
      onUpdateStatus={handleUpdateStatus}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
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
        title={modalTitle}
        onRequestClose={handleModalRequestClose}
        contentStyle={styles.modal}
      >
        {activePicker === "client" ? (
          <>
            <TouchableOpacity
              style={styles.pickerBackButton}
              onPress={() => setActivePicker(null)}
            >
              <Text style={styles.pickerBackButtonText}>Volver</Text>
            </TouchableOpacity>
            <View style={styles.clientList}>
              {clients.map((client) => (
                <TouchableOpacity
                  key={client.id}
                  style={styles.clientItem}
                  onPress={() => handleSelectClient(client)}
                >
                  <Text style={styles.clientItemText}>{client.name}</Text>
                </TouchableOpacity>
              ))}
              {!clients.length ? (
                <EmptyState
                  title="No hay clientes"
                  message="No se encontraron clientes. Puede crear uno nuevo en la pantalla de clientes."
                />
              ) : null}
            </View>
          </>
        ) : (
          <ScrollView>
            <Text style={styles.label}>Cliente *</Text>
            <TouchableOpacity
              style={[
                styles.input,
                errors.clientName ? styles.inputError : null,
              ]}
              onPress={() => setActivePicker("client")}
            >
              <Text
                style={clientName ? styles.inputText : styles.placeholderText}
              >
                {clientName || "Seleccione un cliente"}
              </Text>
            </TouchableOpacity>
            {errors.clientName ? (
              <Text style={styles.errorText}>{errors.clientName.message}</Text>
            ) : (
              <Text style={styles.helpText}>
                Seleccione un cliente existente para asociar el cobro.
              </Text>
            )}
            <Controller
              control={control}
              name="amount"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="Monto (Gs.)"
                  placeholder="Ej: 150000"
                  value={value}
                  onChangeText={(text) => onChange(normalizeAmountInput(text))}
                  keyboardType="number-pad"
                  onBlur={() => {
                    onBlur();
                    onChange(normalizeAmountInput(value));
                  }}
                  error={errors.amount?.message}
                  helpText="Solo numeros, sin puntos ni comas."
                />
              )}
            />
            <Controller
              control={control}
              name="dueDate"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="Fecha de vencimiento (opcional)"
                  placeholder="YYYY-MM-DD"
                  value={value}
                  onChangeText={onChange}
                  onBlur={() => {
                    onBlur();
                    onChange(normalizeDueDate(value));
                  }}
                  error={errors.dueDate?.message}
                  helpText="Ejemplo: 2026-12-31"
                />
              )}
            />
            <Controller
              control={control}
              name="notes"
              render={({ field: { onChange, onBlur, value } }) => (
                <FormField
                  label="Notas"
                  placeholder="Notas..."
                  value={value}
                  onChangeText={onChange}
                  onBlur={() => {
                    onBlur();
                    onChange(normalizeNotes(value));
                  }}
                  multiline
                />
              )}
            />
            <FormActions
              isLoading={
                createChargeMutation.isPending || updateChargeMutation.isPending
              }
              submitLabel={editingCharge ? "Guardar cambios" : "Crear Cobro"}
              onCancel={() => {
                setModalVisible(false);
                setEditingCharge(null);
                reset();
              }}
              onSubmit={saveCharge}
            />
          </ScrollView>
        )}
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const useStyles = (colors: ThemeColors) =>
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
        cardOverdue: {
          borderColor: colors.destructive,
          backgroundColor: colors.destructiveMuted,
        },
        cardPaid: {
          borderColor: colors.success,
        },
        cardQueued: {
          borderColor: colors.warning,
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
        notes: { fontSize: 13, color: colors.foreground, marginTop: 8 },
        queueBadge: {
          alignSelf: "flex-start",
          marginTop: 10,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: colors.warningMuted,
        },
        queueBadgeText: {
          color: colors.warning,
          fontSize: 12,
          fontWeight: "700",
        },
        cardActions: {
          flexDirection: "row",
          gap: 8,
          marginTop: 12,
        },
        primaryButton: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: colors.primary,
          borderRadius: 10,
        },
        primaryButtonText: {
          color: colors.primaryForeground,
          fontWeight: "600",
        },
        secondaryButton: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          backgroundColor: colors.background,
        },
        secondaryButtonText: {
          color: colors.foreground,
          fontWeight: "600",
        },
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
        inputError: {
          borderColor: colors.destructive,
        },
        inputText: {
          fontSize: 16,
          color: colors.foreground,
        },
        placeholderText: {
          fontSize: 16,
          color: colors.mutedForeground,
        },
        helpText: {
          marginTop: -10,
          marginBottom: 16,
          fontSize: 12,
          color: colors.mutedForeground,
        },
        errorText: {
          marginTop: -10,
          marginBottom: 16,
          fontSize: 12,
          color: colors.destructive,
        },
        clientItem: {
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        clientList: {
          gap: 4,
        },
        clientItemText: {
          fontSize: 16,
          color: colors.foreground,
        },
        pickerBackButton: {
          alignSelf: "flex-start",
          paddingHorizontal: 4,
          paddingVertical: 6,
          marginBottom: 12,
        },
        pickerBackButtonText: {
          color: colors.primary,
          fontSize: 14,
          fontWeight: "600",
        },
      }),
    [colors],
  );
