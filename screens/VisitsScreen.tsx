import React, { useState } from "react";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "../contexts/AuthContext";
import {
  useCreateVisit,
  useVisitTypeOptionsData,
  useVisitsData,
} from "../hooks/use-mobile-data";
import type { VisitPeriod, VisitTypeOption } from "../lib/mobile-data";
import type { Tables } from "../lib/types";
import BottomSheetModal from "../components/BottomSheetModal";
import FormActions from "../components/FormActions";
import FormField from "../components/FormField";
import { colors } from "../theme/colors";

type Visit = Tables<"visits">;

const getDefaultVisitType = (types: VisitTypeOption[]) =>
  types.find((item) => item.is_default)?.name || types[0]?.name || "Comercial";

export default function VisitsScreen() {
  const { user, profile } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [period, setPeriod] = useState<VisitPeriod>("week");
  const [form, setForm] = useState({
    clientId: "",
    clientName: "",
    notes: "",
    visitType: "Comercial",
  });

  const { data: visits = [], isLoading } = useVisitsData(user?.id, period);
  const { data: visitTypes = [], isLoading: isLoadingVisitTypes } =
    useVisitTypeOptionsData();
  const createVisitMutation = useCreateVisit();

  const openModal = () => {
    const defaultVisitType = getDefaultVisitType(visitTypes);
    setForm({
      clientId: "",
      clientName: "",
      notes: "",
      visitType: defaultVisitType,
    });
    setModalVisible(true);
  };

  const handleCreateVisit = async () => {
    if (!user || !profile || !form.clientName.trim()) {
      Alert.alert("Error", "Ingrese el nombre del cliente");
      return;
    }

    if (!form.visitType.trim()) {
      Alert.alert("Error", "Seleccione un tipo de visita");
      return;
    }

    try {
      await createVisitMutation.mutateAsync({
        userId: user.id,
        vendorName: profile.full_name || user.email || "Vendedor",
        clientId: form.clientId,
        clientName: form.clientName,
        notes: form.notes,
        visitType: form.visitType,
      });
      setModalVisible(false);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo crear la visita"
      );
    }
  };

  const renderVisit = ({ item }: { item: Visit }) => (
    <View style={styles.visitCard}>
      <View style={styles.visitHeader}>
        <Text style={styles.visitClient}>{item.client_name}</Text>
        <View
          style={[
            styles.badge,
            item.check_out_at ? styles.badgeDone : styles.badgePending,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              item.check_out_at ? styles.badgeTextDone : styles.badgeTextPending,
            ]}
          >
            {item.check_out_at ? "Completada" : "En curso"}
          </Text>
        </View>
      </View>
      <Text style={styles.visitMeta}>
        {item.visit_type} •{" "}
        {format(new Date(item.check_in_at), "dd MMM HH:mm", { locale: es })}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.periodBtn, period === "today" && styles.periodBtnActive]}
          onPress={() => setPeriod("today")}
        >
          <Text
            style={[
              styles.periodText,
              period === "today" && styles.periodTextActive,
            ]}
          >
            Hoy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodBtn, period === "week" && styles.periodBtnActive]}
          onPress={() => setPeriod("week")}
        >
          <Text
            style={[
              styles.periodText,
              period === "week" && styles.periodTextActive,
            ]}
          >
            Semana
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={openModal}>
          <Text style={styles.addBtnText}>+ Nueva Visita</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => item.id}
          renderItem={renderVisit}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Sin visitas en el periodo</Text>
          }
        />
      )}

      <BottomSheetModal
        visible={modalVisible}
        title="Nueva Visita"
        onRequestClose={() => setModalVisible(false)}
        contentStyle={styles.modal}
      >
        <FormField
          label="Cliente"
          placeholder="Nombre del cliente"
          value={form.clientName}
          onChangeText={(text) =>
            setForm((current) => ({ ...current, clientName: text }))
          }
        />

        <Text style={styles.label}>Tipo</Text>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setTypePickerVisible(true)}
          disabled={isLoadingVisitTypes}
        >
          <Text
            style={[
              styles.selectorText,
              !form.visitType && styles.selectorPlaceholder,
            ]}
          >
            {isLoadingVisitTypes
              ? "Cargando tipos..."
              : form.visitType || "Seleccione un tipo"}
          </Text>
        </TouchableOpacity>

        <FormField
          label="Notas (opcional)"
          placeholder="Notas..."
          value={form.notes}
          onChangeText={(text) =>
            setForm((current) => ({ ...current, notes: text }))
          }
          multiline
        />

        <FormActions
          isLoading={createVisitMutation.isPending}
          submitLabel="Crear Visita"
          onCancel={() => setModalVisible(false)}
          onSubmit={handleCreateVisit}
        />
      </BottomSheetModal>

      <BottomSheetModal
        visible={typePickerVisible}
        title="Seleccionar Tipo"
        onRequestClose={() => setTypePickerVisible(false)}
        contentStyle={styles.modal}
      >
        <ScrollView>
          {visitTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.typeOption,
                form.visitType === type.name && styles.typeOptionActive,
              ]}
              onPress={() => {
                setForm((current) => ({ ...current, visitType: type.name }));
                setTypePickerVisible(false);
              }}
            >
              <Text
                style={[
                  styles.typeOptionText,
                  form.visitType === type.name && styles.typeOptionTextActive,
                ]}
              >
                {type.name}
              </Text>
            </TouchableOpacity>
          ))}
          {!visitTypes.length ? (
            <Text style={styles.emptyTypes}>
              No hay tipos de visita activos configurados.
            </Text>
          ) : null}
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  periodBtnActive: { backgroundColor: colors.primary },
  periodText: { fontSize: 14, color: colors.mutedForeground },
  periodTextActive: { color: "#fff", fontWeight: "600" },
  addBtn: {
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  loader: { marginTop: 32 },
  list: { padding: 16, paddingBottom: 32 },
  empty: {
    textAlign: "center",
    color: colors.mutedForeground,
    marginTop: 32,
  },
  visitCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  visitHeader: { flexDirection: "row", justifyContent: "space-between" },
  visitClient: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeDone: { backgroundColor: colors.successMuted },
  badgePending: { backgroundColor: colors.infoMuted },
  badgeText: { fontSize: 12, fontWeight: "600" },
  badgeTextDone: { color: colors.success },
  badgeTextPending: { color: colors.info },
  visitMeta: { fontSize: 13, color: colors.mutedForeground, marginTop: 4 },
  modal: {
  },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 8 },
  selector: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    backgroundColor: colors.card,
  },
  selectorText: { fontSize: 14, color: colors.foreground },
  selectorPlaceholder: { color: colors.mutedForeground },
  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: 10,
  },
  typeOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeOptionText: { fontSize: 14, color: colors.foreground, fontWeight: "600" },
  typeOptionTextActive: { color: "#fff" },
  emptyTypes: { textAlign: "center", color: colors.mutedForeground, marginTop: 12 },
});
