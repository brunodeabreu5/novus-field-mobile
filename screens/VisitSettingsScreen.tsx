import React, { useState } from "react";
import { View, Text, StyleSheet, Switch, ScrollView } from "react-native";
import { colors } from "../theme/colors";

export default function VisitSettingsScreen() {
  const [requirePhoto, setRequirePhoto] = useState(true);
  const [requireSignature, setRequireSignature] = useState(false);
  const [enforceGeofence, setEnforceGeofence] = useState(true);
  
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.description}>
        Configura los parámetros obligatorios para que los vendedores puedan iniciar y finalizar visitas.
      </Text>

      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Requerir Foto</Text>
            <Text style={styles.settingDesc}>
              El vendedor debe tomar una foto del local
            </Text>
          </View>
          <Switch
            value={requirePhoto}
            onValueChange={setRequirePhoto}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Requerir Firma</Text>
            <Text style={styles.settingDesc}>
              Firma digital del cliente al finalizar
            </Text>
          </View>
          <Switch
            value={requireSignature}
            onValueChange={setRequireSignature}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Georeferencia Obligatoria</Text>
            <Text style={styles.settingDesc}>
              Validar que la ubicación coincida con la del cliente
            </Text>
          </View>
          <Switch
            value={enforceGeofence}
            onValueChange={setEnforceGeofence}
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
