import React, { useState } from "react";
import { View, Text, StyleSheet, Switch, ScrollView, TextInput } from "react-native";
import { colors } from "../theme/colors";

export default function AlertConfigScreen() {
  const [deviationsAlert, setDeviationsAlert] = useState(true);
  const [offlineAlert, setOfflineAlert] = useState(true);
  const [idleAlert, setIdleAlert] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState("100");

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.description}>
        Configura las distancias y notificaciones para alertas de desvío y falta de movimiento de los vendedores.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Radio Permitido (metros)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={radiusMeters}
          onChangeText={setRadiusMeters}
          placeholder="Ej: 100"
        />
        <Text style={styles.helperText}>Radio de tolerancia desde la ruta para considerar un desvío.</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>Notificaciones Push</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Notificar Desvíos</Text>
            <Text style={styles.settingDesc}>
              Avisarme cuando alguien sale de ruta
            </Text>
          </View>
          <Switch
            value={deviationsAlert}
            onValueChange={setDeviationsAlert}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>GPS Apagado</Text>
            <Text style={styles.settingDesc}>
              Avisarme si pierden conexión o apagan el GPS
            </Text>
          </View>
          <Switch
            value={offlineAlert}
            onValueChange={setOfflineAlert}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Demasiado Tiempo Inactivo</Text>
            <Text style={styles.settingDesc}>
              Más de 60 mins sin movimiento
            </Text>
          </View>
          <Switch
            value={idleAlert}
            onValueChange={setIdleAlert}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
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
});
