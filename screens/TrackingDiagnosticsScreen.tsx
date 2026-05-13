import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadTrackingDiagnostics,
  type TrackingDiagnostics,
} from "../lib/tracking-diagnostics";
import { useBatteryOptimization } from "../hooks/use-battery-optimization";
import { useTrackingStatus } from "../providers/TrackingProvider";
import { TRACKING_TASK_NAME } from "../lib/vendor-tracking-constants";
import { colors } from "../theme/colors";
import { logger } from "../lib/logger";

function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

function formatDate(ts: number | null): string {
  if (ts === null || ts <= 0) return "—";
  return new Date(ts).toLocaleString("pt-BR");
}

interface CardProps {
  readonly label: string;
  readonly value: string;
  readonly variant?: "default" | "success" | "warning" | "error";
  readonly subtext?: string;
}

function Card({ label, value, variant = "default", subtext }: CardProps) {
  const valueStyle =
    variant === "success"
      ? styles.valueSuccess
      : variant === "warning"
        ? styles.valueWarning
        : variant === "error"
          ? styles.valueError
          : styles.value;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
      {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}
    </View>
  );
}

export default function TrackingDiagnosticsScreen() {
  const { trackingState, trackingError } = useTrackingStatus();
  const batteryOpt = useBatteryOptimization();
  const [diagnostics, setDiagnostics] = useState<TrackingDiagnostics | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [backgroundEnabled, setBackgroundEnabled] = useState<boolean | null>(
    null,
  );
  const [queueSize, setQueueSize] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [diag, bgStatus, queueRaw] = await Promise.all([
        loadTrackingDiagnostics(),
        Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME).catch(
          () => false,
        ),
        AsyncStorage.getItem("novus_offline_queue"),
      ]);
      setDiagnostics(diag);
      setBackgroundEnabled(bgStatus);
      const queue = queueRaw ? (JSON.parse(queueRaw) as unknown[]) : [];
      setQueueSize(queue.length);
    } catch (error) {
      logger.warn(
        "TrackingDiagnostics",
        "Failed to load diagnostics:",
        error instanceof Error ? error.message : error,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const trackingVariant: CardProps["variant"] =
    trackingState === "background"
      ? "success"
      : trackingState === "foreground_only"
        ? "warning"
        : trackingState === "error" || trackingState === "denied"
          ? "error"
          : "default";

  const batteryVariant: CardProps["variant"] =
    batteryOpt.state === "disabled"
      ? "success"
      : batteryOpt.state === "enabled"
        ? "error"
        : "default";

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Diagnostico de rastreo</Text>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 32 }}
        />
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estado atual</Text>
            <Card
              label="Modo de rastreo"
              value={
                trackingState === "background"
                  ? "Background (continuo)"
                  : trackingState === "foreground_only"
                    ? "Solo primer plano"
                    : trackingState === "denied"
                      ? "Permiso negado"
                      : trackingState === "error"
                        ? "Error"
                        : "Inactivo"
              }
              variant={trackingVariant}
              subtext={trackingError ?? undefined}
            />
            <Card
              label="Task de background"
              value={
                backgroundEnabled === null
                  ? "—"
                  : backgroundEnabled
                    ? "Activo"
                    : "Detenido"
              }
              variant={
                backgroundEnabled ? "success" : backgroundEnabled === false ? "error" : "default"
              }
            />
            {Platform.OS === "android" && (
              <Card
                label="Otimizacao de bateria"
                value={
                  batteryOpt.state === "disabled"
                    ? "Desativada (OK)"
                    : batteryOpt.state === "enabled"
                      ? "Ativa (bloqueia rastreo)"
                      : "Verificando..."
                }
                variant={batteryVariant}
                subtext={
                  batteryOpt.state === "enabled"
                    ? "Desative para o rastreo funcionar com a tela bloqueada."
                    : undefined
                }
              />
            )}
          </View>

          {Platform.OS === "android" && batteryOpt.state === "enabled" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Acoes</Text>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => batteryOpt.requestDisable()}
              >
                <Text style={styles.btnTextPrimary}>
                  Pedir para desativar otimizacao
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnPrimary, { marginTop: 8, backgroundColor: colors.mutedForeground }]}
                onPress={() => batteryOpt.openSettings()}
              >
                <Text style={styles.btnTextPrimary}>
                  Abrir ajustes de bateria
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estatisticas</Text>
            <Card
              label="Total de entregas"
              value={String(diagnostics?.totalDeliveries ?? 0)}
            />
            <Card
              label="Entregas por fallback"
              value={String(diagnostics?.totalFallbacks ?? 0)}
            />
            <Card
              label="Intervalo medio"
              value={formatDuration(diagnostics?.avgIntervalMs ?? null)}
            />
            <Card
              label="Ultima entrega"
              value={formatDate(diagnostics?.lastDeliveryAt ?? null)}
            />
            <Card
              label="Fila offline"
              value={String(queueSize ?? 0)}
              variant={queueSize && queueSize > 20 ? "warning" : "default"}
            />
            {diagnostics?.lastErrorAt ? (
              <Card
                label="Ultimo erro"
                value={formatDate(diagnostics.lastErrorAt)}
                variant="error"
                subtext={diagnostics.lastErrorMessage ?? undefined}
              />
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Entregas recentes</Text>
            {diagnostics?.recentDeliveries.length === 0 ? (
              <Text style={styles.empty}>Nenhuma entrega registrada ainda.</Text>
            ) : (
              diagnostics?.recentDeliveries.map((d, i) => (
                <View key={i} style={styles.deliveryRow}>
                  <Text style={styles.deliveryTime}>
                    {new Date(d.timestamp).toLocaleTimeString("pt-BR")}
                  </Text>
                  <Text style={styles.deliveryDetail}>
                    {d.wasFallback
                      ? "fallback"
                      : `${d.locationCount} loc(s)`}
                    {" "}
                    {d.intervalMs ? `(${formatDuration(d.intervalMs)})` : ""}
                  </Text>
                </View>
              ))
            )}
          </View>

          <TouchableOpacity style={styles.btnOutline} onPress={load}>
            <Text style={styles.btnTextOutline}>Atualizar</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.mutedForeground,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.foreground,
    marginBottom: 8,
  },
  value: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  valueSuccess: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: "600",
  },
  valueWarning: {
    fontSize: 14,
    color: colors.warning,
    fontWeight: "600",
  },
  valueError: {
    fontSize: 14,
    color: colors.destructive,
    fontWeight: "600",
  },
  subtext: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  btnPrimary: {
    padding: 14,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: "center",
  },
  btnTextPrimary: {
    fontSize: 14,
    color: colors.primaryForeground,
    fontWeight: "600",
  },
  btnOutline: {
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 32,
  },
  btnTextOutline: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  empty: {
    fontSize: 14,
    color: colors.mutedForeground,
    fontStyle: "italic",
  },
  deliveryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  deliveryTime: {
    fontSize: 13,
    color: colors.foreground,
  },
  deliveryDetail: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
});
