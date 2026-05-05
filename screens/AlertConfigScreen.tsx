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
import { backendApi } from "../lib/backend-api";
import { colors } from "../theme/colors";

type GeofenceConfig = {
  id: string;
  zone_id: string;
  zone_name: string;
  client_name?: string | null;
  custom_radius_meters?: number | null;
  alert_on_enter?: boolean;
  alert_on_exit?: boolean;
  enabled?: boolean;
};

export default function AlertConfigScreen() {
  const [config, setConfig] = useState<GeofenceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState("100");
  const [alertOnEnter, setAlertOnEnter] = useState(true);
  const [alertOnExit, setAlertOnExit] = useState(true);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      setLoading(true);
      try {
        const data = await backendApi.get<GeofenceConfig[]>("/geofence/configs");
        const first = data[0] || null;
        setConfig(first);
        if (first) {
          setRadiusMeters(String(first.custom_radius_meters ?? 100));
          setAlertOnEnter(first.alert_on_enter ?? true);
          setAlertOnExit(first.alert_on_exit ?? true);
          setEnabled(first.enabled ?? true);
        }
      } catch (error) {
        Alert.alert(
          "Error",
          error instanceof Error ? error.message : "No se pudo cargar la configuración"
        );
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;

    const radius = Number(radiusMeters);
    if (Number.isNaN(radius) || radius < 10) {
      Alert.alert("Validación", "El radio debe ser al menos 10 metros.");
      return;
    }

    setSaving(true);
    try {
      await backendApi.patch(`/geofence/configs/${config.id}`, {
        zone_id: config.zone_id,
        zone_name: config.zone_name,
        client_name: config.client_name,
        custom_radius_meters: radius,
        alert_on_enter: alertOnEnter,
        alert_on_exit: alertOnExit,
        enabled,
      });
      Alert.alert("Guardado", "Configuración actualizada correctamente.");
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo guardar la configuración"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!config) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.description}>
          Configura las distancias y notificaciones para alertas de desvío y falta de movimiento de los vendedores.
        </Text>
        <View style={styles.section}>
          <Text style={styles.emptyText}>
            Sin configuraciones de geofence. Use la web de administración para crear zonas.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.description}>
        Configura las distancias y notificaciones para alertas de desvío y falta de movimiento de los vendedores.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Zona</Text>
        <Text style={styles.zoneName}>{config.zone_name}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Radio Permitido (metros)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={radiusMeters}
          onChangeText={setRadiusMeters}
          placeholder="Ej: 100"
        />
        <Text style={styles.helperText}>Radio de tolerancia para considerar un desvío.</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Tipo de Alertas</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Alertar Entrada</Text>
            <Text style={styles.settingDesc}>
              Notificar cuando un vendedor entra en la zona
            </Text>
          </View>
          <Switch
            value={alertOnEnter}
            onValueChange={setAlertOnEnter}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Alertar Salida</Text>
            <Text style={styles.settingDesc}>
              Notificar cuando un vendedor sale de la zona
            </Text>
          </View>
          <Switch
            value={alertOnExit}
            onValueChange={setAlertOnExit}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Configuración Activa</Text>
            <Text style={styles.settingDesc}>
              Habilitar o deshabilitar esta zona
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={styles.saveButtonText}>Guardar Configuración</Text>
          )}
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
    alignItems: "center",
    justifyContent: "center",
  },
  description: {
    fontSize: 14,
    color: colors.mutedForeground,
    padding: 24,
    paddingBottom: 8,
  },
  section: {
    padding: 24,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 8,
  },
  zoneName: {
    fontSize: 16,
    color: colors.foreground,
    fontWeight: "600",
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.foreground,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  settingInfo: {
    flex: 1,
    paddingRight: 16,
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
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: "center",
    lineHeight: 22,
  },
});
