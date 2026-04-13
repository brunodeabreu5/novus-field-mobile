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
  type StyleProp,
  type TextStyle,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { useDevicePermissions } from "../contexts/DevicePermissionsContext";
import type { PermissionState } from "../hooks/use-device-permissions-state";
import FormActions from "../components/FormActions";
import FormField from "../components/FormField";
import { useTrackingStatus, type TrackingState } from "../providers/TrackingProvider";
import { colors } from "../theme/colors";

interface SecuritySectionProps {
  readonly biometricAvailable: boolean;
  readonly biometricEnrolled: boolean;
  readonly biometricEnabled: boolean;
  readonly biometricLabel: string;
  readonly biometricUnlocking: boolean;
  readonly onToggle: (value: boolean) => void;
}

function SecuritySection({
  biometricAvailable,
  biometricEnrolled,
  biometricEnabled,
  biometricLabel,
  biometricUnlocking,
  onToggle,
}: SecuritySectionProps) {
  let description = "Este dispositivo no admite autenticacion biometrica.";
  if (biometricAvailable) {
    if (biometricEnrolled) {
      description = `Use ${biometricLabel} para desbloquear la sesion guardada en este dispositivo.`;
    } else {
      description = "Configure la biometria del dispositivo para activar esta opcion.";
    }
  }

  return (
    <View style={styles.testSection}>
      <Text style={styles.testSectionTitle}>Seguridad</Text>
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>Autenticacion biometrica</Text>
          <Text style={styles.settingDesc}>{description}</Text>
        </View>
        <Switch
          value={biometricEnabled}
          onValueChange={onToggle}
          disabled={!biometricAvailable || !biometricEnrolled || biometricUnlocking}
          trackColor={{ false: colors.border, true: colors.primary }}
        />
      </View>
    </View>
  );
}

interface DeviceSectionProps {
  readonly locationPermission: PermissionState;
  readonly backgroundLocationPermission: PermissionState;
  readonly notificationPermission: PermissionState;
  readonly expoPushToken: string | null;
  readonly lastLocation: { lat: number; lng: number } | null;
  readonly isExpoGo: boolean;
  readonly isWeb: boolean;
  readonly isLoading: boolean;
  readonly lastError: string | null;
  readonly trackingState: TrackingState;
  readonly trackingError: string | null;
  readonly refreshPermissions: () => Promise<void>;
  readonly requestBackgroundLocationPermission: () => Promise<void>;
  readonly requestNotificationPermission: () => Promise<void>;
}

interface StatusCardProps {
  readonly children: React.ReactNode;
}

function StatusCard({ children }: StatusCardProps) {
  return <View style={styles.testCard}>{children}</View>;
}

interface GpsStatusCardProps {
  readonly locationPermission: PermissionState;
  readonly lastLocation: { lat: number; lng: number } | null;
  readonly isWeb: boolean;
  readonly isLoading: boolean;
}

function GpsStatusCard({
  locationPermission,
  lastLocation,
  isWeb,
  isLoading,
}: GpsStatusCardProps) {
  let statusText = "Pendente";
  let statusStyle: StyleProp<TextStyle> = styles.testValue;
  let showCoordinates = false;

  if (locationPermission === "granted") {
    statusText = "OK";
    statusStyle = styles.testValueSuccess;
    showCoordinates = true;
  } else if (locationPermission === "denied") {
    statusText = "Bloqueado";
    statusStyle = styles.testError;
  }

  if (isWeb) {
    return (
      <StatusCard>
        <Text style={styles.testLabel}>GPS</Text>
        <Text style={styles.testValue}>N/A (web)</Text>
      </StatusCard>
    );
  }

  if (isLoading) {
    return (
      <StatusCard>
        <Text style={styles.testLabel}>GPS</Text>
        <ActivityIndicator size="small" color={colors.primary} />
      </StatusCard>
    );
  }

  return (
    <StatusCard>
      <Text style={styles.testLabel}>GPS</Text>
      <Text style={[styles.testValue, statusStyle]}>{statusText}</Text>
      {showCoordinates && lastLocation ? (
        <Text style={styles.testSubtext}>
          {lastLocation.lat.toFixed(5)}, {lastLocation.lng.toFixed(5)}
        </Text>
      ) : null}
      <Text style={styles.testSubtext}>
        El GPS se usa para visitas, clientes en mapa y rastreo. La ubicacion en
        segundo plano se activa por separado.
      </Text>
    </StatusCard>
  );
}

interface BackgroundStatusCardProps {
  readonly locationPermission: PermissionState;
  readonly backgroundLocationPermission: PermissionState;
  readonly isLoading: boolean;
  readonly onRequestBackgroundLocationPermission: () => Promise<void>;
}

function BackgroundStatusCard({
  locationPermission,
  backgroundLocationPermission,
  isLoading,
  onRequestBackgroundLocationPermission,
}: BackgroundStatusCardProps) {
  let statusText = "Pendente";
  let statusStyle: StyleProp<TextStyle> = styles.testValue;

  if (backgroundLocationPermission === "granted") {
    statusText = "Autorizado";
    statusStyle = styles.testValueSuccess;
  } else if (backgroundLocationPermission === "denied") {
    statusText = "Negado";
    statusStyle = styles.testError;
  }

  let description =
    "Sin este permiso, el vendedor quedara bloqueado y no podra seguir reportando ubicacion.";
  if (backgroundLocationPermission === "granted") {
    description = "El rastreo queda activo aunque la app pase a segundo plano.";
  } else if (locationPermission !== "granted") {
    description = "Primero autorice el GPS normal para poder activar el rastreo continuo.";
  }

  return (
    <StatusCard>
      <Text style={styles.testLabel}>GPS en background</Text>
      <Text style={[styles.testValue, statusStyle]}>{statusText}</Text>
      <Text style={styles.testSubtext}>{description}</Text>
      {backgroundLocationPermission !== "granted" ? (
        <TouchableOpacity
          style={[styles.testBtn, styles.testBtnPrimary]}
          onPress={() => {
            void onRequestBackgroundLocationPermission();
          }}
          disabled={isLoading || locationPermission !== "granted"}
        >
          <Text style={styles.testBtnTextPrimary}>Ativar GPS em background</Text>
        </TouchableOpacity>
      ) : null}
    </StatusCard>
  );
}

interface TrackingStatusCardProps {
  readonly trackingState: TrackingState;
  readonly trackingError: string | null;
}

function TrackingStatusCard({
  trackingState,
  trackingError,
}: TrackingStatusCardProps) {
  let statusText = "No aplica";
  let statusStyle: StyleProp<TextStyle> = styles.testValue;

  if (trackingState === "background") {
    statusText = "Activo en background";
    statusStyle = styles.testValueSuccess;
  } else if (trackingState === "foreground_only") {
    statusText = "Solo en primer plano";
    statusStyle = styles.testValueWarning;
  } else if (trackingState === "denied") {
    statusText = "Bloqueado";
    statusStyle = styles.testError;
  } else if (trackingState === "error") {
    statusText = "Error de rastreo";
    statusStyle = styles.testError;
  }

  return (
    <StatusCard>
      <Text style={styles.testLabel}>Estado del rastreo</Text>
      <Text style={[styles.testValue, statusStyle]}>{statusText}</Text>
      {trackingState === "denied" ? (
        <Text style={styles.testSubtext}>
          El sistema no concedio el permiso requerido. El vendedor no seguira
          transmitiendo ubicacion hasta autorizarlo.
        </Text>
      ) : null}
      {trackingState === "foreground_only" ? (
        <Text style={styles.testSubtext}>
          La app tiene GPS normal, pero todavia no tiene permiso en segundo plano.
          El rastreo continuo no se activara hasta autorizarlo desde ajustes.
        </Text>
      ) : null}
      {trackingError ? <Text style={styles.testSubtext}>{trackingError}</Text> : null}
    </StatusCard>
  );
}

interface NotificationStatusCardProps {
  readonly notificationPermission: PermissionState;
  readonly expoPushToken: string | null;
  readonly isExpoGo: boolean;
  readonly isWeb: boolean;
  readonly isLoading: boolean;
  readonly onRequestNotificationPermission: () => Promise<void>;
}

interface NotificationBodyProps {
  readonly notificationPermission: PermissionState;
  readonly expoPushToken: string | null;
  readonly isExpoGo: boolean;
  readonly isWeb: boolean;
  readonly isLoading: boolean;
  readonly onRequestNotificationPermission: () => Promise<void>;
}

function NotificationBody({
  notificationPermission,
  expoPushToken,
  isExpoGo,
  isWeb,
  isLoading,
  onRequestNotificationPermission,
}: NotificationBodyProps) {
  let statusText = "Pendente";
  let statusStyle: StyleProp<TextStyle> = styles.testValue;
  let statusDetails: React.ReactNode = null;

  if (notificationPermission === "granted") {
    statusText = "OK";
    statusStyle = styles.testValueSuccess;
    if (expoPushToken) {
      statusDetails = (
        <Text style={styles.testSubtext} numberOfLines={2}>
          Token registrado
        </Text>
      );
    } else {
      statusDetails = (
        <Text style={styles.testSubtext}>
          Permissao concedida. Aguardando registro do token.
        </Text>
      );
    }
  } else if (notificationPermission === "denied") {
    statusText = "Negado";
    statusStyle = styles.testError;
    statusDetails = (
      <TouchableOpacity
        style={[styles.testBtn, styles.testBtnPrimary]}
        onPress={() => {
          void onRequestNotificationPermission();
        }}
        disabled={isLoading}
      >
        <Text style={styles.testBtnTextPrimary}>Ativar notificacoes</Text>
      </TouchableOpacity>
    );
  } else {
    statusDetails = (
      <TouchableOpacity
        style={[styles.testBtn, styles.testBtnPrimary]}
        onPress={() => {
          void onRequestNotificationPermission();
        }}
        disabled={isLoading}
      >
        <Text style={styles.testBtnTextPrimary}>Ativar notificacoes</Text>
      </TouchableOpacity>
    );
  }

  if (isWeb) {
    return <Text style={styles.testValue}>N/A (web)</Text>;
  }

  if (isExpoGo) {
    return (
      <>
        <Text style={styles.testValue}>Expo Go</Text>
        <Text style={styles.testSubtext}>Push indisponivel. Use development build.</Text>
      </>
    );
  }

  if (isLoading) {
    return <ActivityIndicator size="small" color={colors.primary} />;
  }

  return (
    <>
      <Text style={[styles.testValue, statusStyle]}>{statusText}</Text>
      {statusDetails}
    </>
  );
}

function NotificationStatusCard({
  notificationPermission,
  expoPushToken,
  isExpoGo,
  isWeb,
  isLoading,
  onRequestNotificationPermission,
}: NotificationStatusCardProps) {
  return (
    <StatusCard>
      <Text style={styles.testLabel}>Notificacoes</Text>
      <NotificationBody
        notificationPermission={notificationPermission}
        expoPushToken={expoPushToken}
        isExpoGo={isExpoGo}
        isWeb={isWeb}
        isLoading={isLoading}
        onRequestNotificationPermission={onRequestNotificationPermission}
      />
    </StatusCard>
  );
}

function DeviceSection({
  locationPermission,
  backgroundLocationPermission,
  notificationPermission,
  expoPushToken,
  lastLocation,
  isExpoGo,
  isWeb,
  isLoading,
  lastError,
  trackingState,
  trackingError,
  refreshPermissions,
  requestBackgroundLocationPermission,
  requestNotificationPermission,
}: DeviceSectionProps) {
  return (
    <View style={styles.testSection}>
      <Text style={styles.testSectionTitle}>Dispositivo</Text>
      <GpsStatusCard
        locationPermission={locationPermission}
        lastLocation={lastLocation}
        isWeb={isWeb}
        isLoading={isLoading}
      />
      <BackgroundStatusCard
        locationPermission={locationPermission}
        backgroundLocationPermission={backgroundLocationPermission}
        isLoading={isLoading}
        onRequestBackgroundLocationPermission={requestBackgroundLocationPermission}
      />
      <TrackingStatusCard
        trackingState={trackingState}
        trackingError={trackingError}
      />
      <NotificationStatusCard
        notificationPermission={notificationPermission}
        expoPushToken={expoPushToken}
        isExpoGo={isExpoGo}
        isWeb={isWeb}
        isLoading={isLoading}
        onRequestNotificationPermission={requestNotificationPermission}
      />

      {lastError ? (
        <View style={styles.testCard}>
          <Text style={styles.testLabel}>Ultimo erro</Text>
          <Text style={styles.testError}>{lastError}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.testBtn, styles.testBtnPrimary]}
        onPress={() => {
          void refreshPermissions();
        }}
        disabled={isLoading}
      >
        <Text style={styles.testBtnTextPrimary}>Atualizar status</Text>
      </TouchableOpacity>
    </View>
  );
}

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
    requestBackgroundLocationPermission,
    requestNotificationPermission,
  } = useDevicePermissions();
  const { trackingState, trackingError } = useTrackingStatus();
  const { clearTenant, tenant } = useTenant();
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
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  const handleChangeTenant = () => {
    Alert.alert("Cambiar empresa", `Desea salir de ${tenant?.displayName || "la empresa actual"} y elegir otra?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cambiar",
        style: "destructive",
        onPress: () => {
          void (async () => {
            await signOut();
            await clearTenant();
          })();
        },
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

      <SecuritySection
        biometricAvailable={biometricAvailable}
        biometricEnrolled={biometricEnrolled}
        biometricEnabled={biometricEnabled}
        biometricLabel={biometricLabel}
        biometricUnlocking={biometricUnlocking}
        onToggle={handleBiometricToggle}
      />

      <DeviceSection
        locationPermission={locationPermission}
        backgroundLocationPermission={backgroundLocationPermission}
        notificationPermission={notificationPermission}
        expoPushToken={expoPushToken}
        lastLocation={lastLocation}
        isExpoGo={isExpoGo}
        isWeb={isWeb}
        isLoading={isLoading}
        lastError={lastError}
        trackingState={trackingState}
        trackingError={trackingError}
        refreshPermissions={refreshPermissions}
        requestBackgroundLocationPermission={requestBackgroundLocationPermission}
        requestNotificationPermission={requestNotificationPermission}
      />

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Cerrar sesion</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.switchTenantBtn} onPress={handleChangeTenant}>
        <Text style={styles.switchTenantText}>Cambiar empresa</Text>
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
  switchTenantBtn: {
    marginTop: 12,
    padding: 14,
    alignItems: "center",
  },
  switchTenantText: { color: colors.primary, fontWeight: "600" },
});
