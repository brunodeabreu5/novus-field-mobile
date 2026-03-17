import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  useUpdateVisitSettings,
  useVisitSettingsData,
} from "../hooks/use-mobile-data";
import { colors } from "../theme/colors";

export default function VisitSettingsScreen() {
  const { data: settings, isLoading } = useVisitSettingsData();
  const updateMutation = useUpdateVisitSettings();
  const [minDuration, setMinDuration] = useState("5");
  const [countFrom, setCountFrom] = useState("1");
  const [useExcludeFilter, setUseExcludeFilter] = useState(false);
  const [excludeUnder, setExcludeUnder] = useState("5");
  const [overtimeThreshold, setOvertimeThreshold] = useState("30");

  useEffect(() => {
    if (!settings) {
      return;
    }

    setMinDuration(String(settings.min_duration_minutes));
    setCountFrom(String(settings.count_from_minutes));
    setUseExcludeFilter(settings.exclude_under_minutes !== null);
    setExcludeUnder(String(settings.exclude_under_minutes ?? 5));
    setOvertimeThreshold(String(settings.overtime_threshold_minutes));
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        min_duration_minutes: Math.max(1, Number(minDuration) || 1),
        count_from_minutes: Math.max(1, Number(countFrom) || 1),
        exclude_under_minutes: useExcludeFilter
          ? Math.max(0, Number(excludeUnder) || 0)
          : null,
        overtime_threshold_minutes: Math.max(1, Number(overtimeThreshold) || 1),
      });
      Alert.alert("Guardado", "La configuración de visitas fue actualizada.");
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo guardar la configuración.",
      );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.description}>
        Configura las reglas de conteo y clasificación de visitas que usarán el web y el mobile.
      </Text>

      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Duración mínima</Text>
            <Text style={styles.settingDesc}>
              Minutos mínimos para considerar una visita como válida.
            </Text>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={minDuration}
            onChangeText={setMinDuration}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Contar desde</Text>
            <Text style={styles.settingDesc}>
              Minutos a partir de los cuales la visita entra en reportes.
            </Text>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={countFrom}
            onChangeText={setCountFrom}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Filtrar visitas cortas</Text>
            <Text style={styles.settingDesc}>
              Excluir visitas por debajo de un umbral adicional.
            </Text>
          </View>
          <Switch
            value={useExcludeFilter}
            onValueChange={setUseExcludeFilter}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        {useExcludeFilter ? (
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Excluir por debajo de</Text>
              <Text style={styles.settingDesc}>
                Visitas menores a este valor no contarán.
              </Text>
            </View>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={excludeUnder}
              onChangeText={setExcludeUnder}
            />
          </View>
        ) : null}

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Umbral de horas extra</Text>
            <Text style={styles.settingDesc}>
              Minutos para alertar visitas excesivamente largas.
            </Text>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={overtimeThreshold}
            onChangeText={setOvertimeThreshold}
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, updateMutation.isPending && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={updateMutation.isPending}
        >
          <Text style={styles.saveButtonText}>
            {updateMutation.isPending ? "Guardando..." : "Guardar configuración"}
          </Text>
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
  description: {
    fontSize: 14,
    color: colors.mutedForeground,
    padding: 24,
    paddingBottom: 8,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    padding: 16,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingInfo: {
    flex: 1,
    paddingRight: 16,
  },
  input: {
    minWidth: 72,
    textAlign: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  saveButton: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontWeight: "700",
    fontSize: 15,
  },
});
