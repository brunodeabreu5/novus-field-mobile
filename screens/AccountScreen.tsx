import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useDevicePermissions } from "../contexts/DevicePermissionsContext";
import FormActions from "../components/FormActions";
import FormField from "../components/FormField";
import { useTrackingStatus } from "../providers/TrackingProvider";
import { colors } from "../theme/colors";

export default function AccountScreen() {
  const {
    user,
    profile,
    signOut,
    updateProfile,
    biometricAvailable,
    biometricEnrolled,
    biometricEnabled,
    biometricLabel,
    biometricUnlocking,
    enableBiometrics,
    disableBiometrics,
  } = useAuth();
  const {
    locationPermission,
    backgroundLocationPermission,
    notificationPermission,
    expoPushToken,
    lastLocation,
    isExpoGo,
    isWeb,
    isLoading,
    lastError,
    refreshPermissions,
    requestLocationPermission,
    requestNotificationPermission,
  } = useDevicePermissions();
  const { trackingState, trackingError } = useTrackingStatus();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [roleTitle, setRoleTitle] = useState(profile?.role_title || "");

  useEffect(() => {
    setFullName(profile?.full_name || "");
    setPhone(profile?.phone || "");
    setRoleTitle(profile?.role_title || "");
  }, [profile?.full_name, profile?.phone, profile?.role_title]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        role_title: roleTitle.trim() || null,
      });
      setEditing(false);
    } catch {
      Alert.alert("Error", "No se pudo actualizar el perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Cerrar sesion", "Desea cerrar sesion?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesion",
        style: "destructive",
        onPress: () => signOut(),
      },
    ]);
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const enabled = await enableBiometrics();

      if (!enabled) {
        Alert.alert(
          "Biometria no disponible",
          biometricAvailable
            ? "Configure la biometria del dispositivo y vuelva a intentarlo."
            : "Este dispositivo no admite autenticacion biometrica."
        );
      }

      return;
    }

    await disableBiometrics();
  };

  const trackingStatusLabel =
    trackingState === "background"
      ? "Activo en background"
      : trackingState === "foreground_only"
        ? "Activo solo con la app abierta"
        : trackingState === "denied"
          ? "Permiso denegado"
          : trackingState === "error"
            ? "Error de rastreo"
            : "No aplica";

  const trackingStatusStyle =
    trackingState === "background"
      ? styles.testValueSuccess
      : trackingState === "foreground_only"
        ? styles.testValueWarning
        : trackingState === "denied" || trackingState === "error"
          ? styles.testError
          : styles.testValue;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarBox}>
        <Text style={styles.avatarText}>
          {(profile?.full_name || user?.email || "?")[0].toUpperCase()}
        </Text>
      </View>

      <Text style={styles.email}>{user?.email}</Text>

      {editing ? (
        <>
          <FormField
            label="Nombre completo"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Nombre"
          />
          <FormField
            label="Telefono"
            value={phone}
            onChangeText={setPhone}
            placeholder="Telefono"
            keyboardType="phone-pad"
          />
          <FormField
            label="Cargo / Rol"
            value={roleTitle}
            onChangeText={setRoleTitle}
            placeholder="Ej: Vendedor"
          />
          <FormActions
            isLoading={saving}
            submitLabel="Guardar"
            onCancel={() => {
              setEditing(false);
              setFullName(profile?.full_name || "");
              setPhone(profile?.phone || "");
              setRoleTitle(profile?.role_title || "");
            }}
            onSubmit={handleSave}
          />
        </>
      ) : (
        <>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nombre</Text>
            <Text style={styles.infoValue}>{profile?.full_name || "-"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Telefono</Text>
            <Text style={styles.infoValue}>{profile?.phone || "-"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cargo</Text>
            <Text style={styles.infoValue}>{profile?.role_title || "-"}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
            <Text style={styles.editBtnText}>Editar perfil</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.testSection}>
        <Text style={styles.testSectionTitle}>Seguridad</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Autenticacion biometrica</Text>
            <Text style={styles.settingDesc}>
              {biometricAvailable
                ? biometricEnrolled
                  ? `Use ${biometricLabel} para desbloquear la sesion guardada en este dispositivo.`
                  : "Configure la biometria del dispositivo para activar esta opcion."
                : "Este dispositivo no admite autenticacion biometrica."}
            </Text>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={handleBiometricToggle}
            disabled={!biometricAvailable || !biometricEnrolled || biometricUnlocking}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      </View>

      <View style={styles.testSection}>
        <Text style={styles.testSectionTitle}>Dispositivo</Text>

        <View style={styles.testCard}>
          <Text style={styles.testLabel}>GPS</Text>
          {isWeb ? (
            <Text style={styles.testValue}>N/A (web)</Text>
          ) : isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : locationPermission === "granted" ? (
            <>
              <Text style={[styles.testValue, styles.testValueSuccess]}>OK</Text>
              {lastLocation ? (
                <Text style={styles.testSubtext}>
                  {lastLocation.lat.toFixed(5)}, {lastLocation.lng.toFixed(5)}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text
                style={
                  locationPermission === "denied"
                    ? styles.testError
                    : styles.testValue
                }
              >
                {locationPermission === "denied" ? "Negado" : "Pendente"}
              </Text>
              <TouchableOpacity
                style={[styles.testBtn, styles.testBtnPrimary]}
                onPress={requestLocationPermission}
                disabled={isLoading}
              >
                <Text style={styles.testBtnTextPrimary}>Ativar GPS</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.testCard}>
          <Text style={styles.testLabel}>GPS en background</Text>
          <Text
            style={
              backgroundLocationPermission === "granted"
                ? [styles.testValue, styles.testValueSuccess]
                : backgroundLocationPermission === "denied"
                  ? styles.testError
                  : styles.testValue
            }
          >
            {backgroundLocationPermission === "granted"
              ? "Autorizado"
              : backgroundLocationPermission === "denied"
                ? "Negado"
                : "Pendente"}
          </Text>
          {backgroundLocationPermission !== "granted" ? (
            <Text style={styles.testSubtext}>
              Sin este permiso, el historial solo se completa cuando la app esta
              abierta.
            </Text>
          ) : (
            <Text style={styles.testSubtext}>
              Para el rastreo mas estable posible, deje la app autorizada en
              segundo plano y evite cerrarla a la fuerza.
            </Text>
          )}
        </View>

        <View style={styles.testCard}>
          <Text style={styles.testLabel}>Estado del rastreo</Text>
          <Text style={[styles.testValue, trackingStatusStyle]}>
            {trackingStatusLabel}
          </Text>
          {trackingState === "foreground_only" ? (
            <Text style={styles.testSubtext}>
              El rastreo sigue activo, pero fuera del primer plano puede faltar
              parte del recorrido.
            </Text>
          ) : null}
          {trackingError ? (
            <Text style={styles.testSubtext}>{trackingError}</Text>
          ) : null}
        </View>

        <View style={styles.testCard}>
          <Text style={styles.testLabel}>Notificacoes</Text>
          {isWeb ? (
            <Text style={styles.testValue}>N/A (web)</Text>
          ) : isExpoGo ? (
            <>
              <Text style={styles.testValue}>Expo Go</Text>
              <Text style={styles.testSubtext}>
                Push indisponivel. Use development build.
              </Text>
            </>
          ) : isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : notificationPermission === "granted" ? (
            <>
              <Text style={[styles.testValue, styles.testValueSuccess]}>OK</Text>
              {expoPushToken ? (
                <Text style={styles.testSubtext} numberOfLines={2}>
                  Token registrado
                </Text>
              ) : (
                <Text style={styles.testSubtext}>
                  Permissao concedida. Aguardando registro do token.
                </Text>
              )}
            </>
          ) : (
            <>
              <Text
                style={
                  notificationPermission === "denied"
                    ? styles.testError
                    : styles.testValue
                }
              >
                {notificationPermission === "denied" ? "Negado" : "Pendente"}
              </Text>
              <TouchableOpacity
                style={[styles.testBtn, styles.testBtnPrimary]}
                onPress={requestNotificationPermission}
                disabled={isLoading}
              >
                <Text style={styles.testBtnTextPrimary}>Ativar notificacoes</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {lastError ? (
          <View style={styles.testCard}>
            <Text style={styles.testLabel}>Ultimo erro</Text>
            <Text style={styles.testError}>{lastError}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.testBtn, styles.testBtnPrimary]}
          onPress={refreshPermissions}
          disabled={isLoading}
        >
          <Text style={styles.testBtnTextPrimary}>Atualizar status</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Cerrar sesion</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24 },
  avatarBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, color: "#fff", fontWeight: "600" },
  email: {
    fontSize: 16,
    color: colors.mutedForeground,
    textAlign: "center",
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: { fontSize: 14, color: colors.mutedForeground },
  infoValue: { fontSize: 14, fontWeight: "500", color: colors.foreground },
  editBtn: {
    marginTop: 24,
    padding: 14,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: "center",
  },
  editBtnText: { color: "#fff", fontWeight: "600" },
  testSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  settingInfo: {
    flex: 1,
    paddingRight: 16,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  testSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.mutedForeground,
    marginBottom: 12,
  },
  testCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  testLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.foreground,
    marginBottom: 8,
  },
  testValue: { fontSize: 14, color: colors.mutedForeground },
  testValueSuccess: { color: colors.accent },
  testValueWarning: { color: colors.warning },
  testError: { fontSize: 14, color: colors.destructive, marginBottom: 8 },
  testSubtext: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  testBtn: {
    marginTop: 8,
    padding: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  testBtnPrimary: {
    backgroundColor: colors.primary,
  },
  testBtnTextPrimary: { fontSize: 14, color: "#fff", fontWeight: "600" },
  signOutBtn: {
    marginTop: 32,
    padding: 14,
    alignItems: "center",
  },
  signOutText: { color: colors.destructive, fontWeight: "600" },
});
