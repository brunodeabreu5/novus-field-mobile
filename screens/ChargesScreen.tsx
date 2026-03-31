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
  useUpdateCharge,
  useUpdateChargeStatus,
} from "../hooks/use-mobile-data";
import type { ChargeRecord, Client } from "../lib/mobile-data";
import type { ThemeColors } from "../theme/colors";

const STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  atrasado: "Atrasado",
};

const formatAmount = (value: number) => `Gs. ${value.toLocaleString("es-PY")}`;
const normalizeClientName = (value: string) => value.replace(/\s+/g, " ").trim();
const normalizeAmountInput = (value: string) => value.replace(/\D/g, "");
const normalizeDueDate = (value: string) => value.trim();
const normalizeNotes = (value: string) => value.replace(/\s+/g, " ").trim();

const ChargeCard = React.memo(({
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
        Vence: {format(new Date(item.due_date), "dd MMM yyyy", { locale: es })}
      </Text>
    ) : null}
    {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
    {item.queued ? (
      <View style={styles.queueBadge}>
        <Text style={styles.queueBadgeText}>Pendiente de sync</Text>
      </View>
    ) : null}
    <View style={styles.cardActions}>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => onEdit(item)}>
        <Text style={styles.secondaryButtonText}>Editar</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.primaryButton} onPress={() => onUpdateStatus(item)}>
        <Text style={styles.primaryButtonText}>Cambiar estado</Text>
      </TouchableOpacity>
    </View>
  </View>
));

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
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    clientId: "",
    clientName: "",
    amount: "",
    dueDate: "",
    notes: "",
  });

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
    setTouched({});
    setForm({
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
    setTouched({});
    setForm({
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
    setForm((current) => ({
      ...current,
      clientId: client.id,
      clientName: client.name,
    }));
    setActivePicker(null);
  };

  const handleModalRequestClose = () => {
    if (activePicker) {
      setActivePicker(null);
      return;
    }

    setModalVisible(false);
    setEditingCharge(null);
    setTouched({});
  };

  const markTouched = (field: string) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    const normalizedClientName = normalizeClientName(form.clientName);
    const amount = Number.parseInt(normalizeAmountInput(form.amount), 10);
    const normalizedDueDate = normalizeDueDate(form.dueDate);

    if (!normalizedClientName) {
      errors.clientName = "El cliente es obligatorio.";
    }

    if (!form.amount.trim()) {
      errors.amount = "Ingrese un monto.";
    } else if (Number.isNaN(amount) || amount <= 0) {
      errors.amount = "Ingrese un monto valido.";
    }

    if (normalizedDueDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(normalizedDueDate)) {
        errors.dueDate = "Use el formato YYYY-MM-DD.";
      } else {
        const dueDate = new Date(normalizedDueDate);
        if (Number.isNaN(dueDate.getTime())) {
          errors.dueDate = "La fecha no es valida.";
        } else if (dueDate < startOfDay(new Date())) {
          errors.dueDate = "La fecha no puede ser anterior a hoy.";
        }
      }
    }

    return errors;
  }, [form.amount, form.clientName, form.dueDate]);

  const modalTitle = activePicker === "client" ? "Seleccionar Cliente" : editingCharge ? "Editar Cobro" : "Nuevo Cobro";

  const saveCharge = async () => {
    const normalizedClientName = normalizeClientName(form.clientName);
    const normalizedAmount = normalizeAmountInput(form.amount);
    const normalizedDueDate = normalizeDueDate(form.dueDate);
    const normalizedNotes = normalizeNotes(form.notes);

    if (!user || !profile || !normalizedClientName) {
      markTouched("clientName");
      Alert.alert("Error", "El cliente es obligatorio");
      return;
    }

    const amount = Number.parseInt(normalizedAmount, 10);
    if (Number.isNaN(amount) || amount <= 0) {
      markTouched("amount");
      Alert.alert("Error", "Ingrese un monto valido");
      return;
    }

    if (normalizedDueDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(normalizedDueDate)) {
        markTouched("dueDate");
        Alert.alert(
          "Error",
          "El formato de fecha debe ser exactamente YYYY-MM-DD"
        );
        return;
      }
      const dueDate = new Date(normalizedDueDate);
      if (Number.isNaN(dueDate.getTime())) {
        markTouched("dueDate");
        Alert.alert("Error", "La fecha ingresada no es válida en el calendario");
        return;
      }
      const today = startOfDay(new Date());
      if (dueDate < today) {
        markTouched("dueDate");
        Alert.alert(
          "Error",
          "La fecha de vencimiento no puede ser anterior a hoy"
        );
        return;
      }
    }

    try {
      if (editingCharge) {
        await updateChargeMutation.mutateAsync({
          userId: user.id,
          chargeId: editingCharge.id,
          clientId: form.clientId,
          clientName: normalizedClientName,
          amount,
          dueDate: normalizedDueDate,
          notes: normalizedNotes,
        });
      } else {
        await createChargeMutation.mutateAsync({
          userId: user.id,
          vendorName: profile.full_name || user.email || "Vendedor",
          clientId: form.clientId,
          clientName: normalizedClientName,
          amount,
          dueDate: normalizedDueDate,
          notes: normalizedNotes,
        });
      }
      setModalVisible(false);
      setEditingCharge(null);
      setTouched({});
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo crear el cobro"
      );
    }
  };

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
            void updateChargeStatusMutation.mutateAsync({
              userId: user.id,
              chargeId: charge.id,
              status,
            }).catch((error) => {
              Alert.alert(
                "Error",
                error instanceof Error ? error.message : "No se pudo actualizar el estado",
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
              style={[styles.input, touched.clientName && fieldErrors.clientName ? styles.inputError : null]}
              onPress={() => setActivePicker("client")}
            >
              <Text
                style={form.clientName ? styles.inputText : styles.placeholderText}
              >
                {form.clientName || "Seleccione un cliente"}
              </Text>
            </TouchableOpacity>
            {touched.clientName && fieldErrors.clientName ? (
              <Text style={styles.errorText}>{fieldErrors.clientName}</Text>
            ) : (
              <Text style={styles.helpText}>Seleccione un cliente existente para asociar el cobro.</Text>
            )}
            <FormField
              label="Monto (Gs.)"
              placeholder="Ej: 150000"
              value={form.amount}
              onChangeText={(text) =>
                setForm((current) => ({
                  ...current,
                  amount: normalizeAmountInput(text),
                }))
              }
              keyboardType="number-pad"
              onBlur={() => {
                markTouched("amount");
                setForm((current) => ({ ...current, amount: normalizeAmountInput(current.amount) }));
              }}
              error={touched.amount ? fieldErrors.amount : null}
              helpText={!touched.amount ? "Solo numeros, sin puntos ni comas." : null}
            />
            <FormField
              label="Fecha de vencimiento (opcional)"
              placeholder="YYYY-MM-DD"
              value={form.dueDate}
              onChangeText={(text) =>
                setForm((current) => ({ ...current, dueDate: text }))
              }
              onBlur={() => {
                markTouched("dueDate");
                setForm((current) => ({ ...current, dueDate: normalizeDueDate(current.dueDate) }));
              }}
              error={touched.dueDate ? fieldErrors.dueDate : null}
              helpText={!touched.dueDate ? "Ejemplo: 2026-12-31" : null}
            />
            <FormField
              label="Notas"
              placeholder="Notas..."
              value={form.notes}
              onChangeText={(text) =>
                setForm((current) => ({ ...current, notes: text }))
              }
              onBlur={() =>
                setForm((current) => ({ ...current, notes: normalizeNotes(current.notes) }))
              }
              multiline
            />
            <FormActions
              isLoading={createChargeMutation.isPending || updateChargeMutation.isPending}
              submitLabel={editingCharge ? "Guardar cambios" : "Crear Cobro"}
              onCancel={() => {
                setModalVisible(false);
                setEditingCharge(null);
                setTouched({});
              }}
              onSubmit={saveCharge}
            />
          </ScrollView>
        )}
      </BottomSheetModal>
    </View>
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
    [colors]
  );
