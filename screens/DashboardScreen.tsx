import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useDashboardData } from "../hooks/use-mobile-data";
import type { Visit } from "../lib/mobile-data";
import { colors } from "../theme/colors";
import { spacing, fontSize, radius } from "../theme/spacing";

const VISIT_TYPE_LABELS: Record<string, string> = {
  Venta: "Venta",
  Cobranza: "Cobranza",
  Prospección: "Prospección",
  Atención: "Atención",
  Comercial: "Comercial",
};

export default function DashboardScreen() {
  const { user, profile } = useAuth();
  const { data, isLoading, error } = useDashboardData(user?.id);

  const stats = data?.stats ?? {
    visitsToday: 0,
    clientsCount: 0,
    totalCharges: 0,
    completedVisits: 0,
    totalVisits: 0,
  };
  const recentVisits = data?.recentVisits ?? [];
  const visitChart = data?.visitChart ?? [];
  const conversionRate =
    stats.totalVisits > 0
      ? Math.round((stats.completedVisits / stats.totalVisits) * 100)
      : 0;
  const firstName = profile?.full_name?.split(" ")[0] || "Vendedor";
  const maxVisitas = Math.max(...visitChart.map((item) => item.visitas), 1);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Hola, {firstName}</Text>
      <Text style={styles.subtitle}>Tu resumen de actividad de hoy</Text>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>No se pudo cargar el panel.</Text>
          <Text style={styles.errorText}>{error.message}</Text>
        </View>
      ) : null}

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Visitas Hoy</Text>
          <Text style={styles.kpiValue}>{stats.visitsToday}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Clientes</Text>
          <Text style={styles.kpiValue}>{stats.clientsCount}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Cobros (M)</Text>
          <Text style={styles.kpiValue}>
            Gs. {(stats.totalCharges / 1000000).toFixed(1)}
          </Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Completado</Text>
          <Text style={styles.kpiValue}>{conversionRate}%</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Visitas por Hora</Text>
        {visitChart.some((item) => item.visitas > 0) ? (
          <View style={styles.chart}>
            {visitChart
              .filter((_, index) => index % 2 === 0)
              .map((item) => (
                <View key={item.hour} style={styles.barRow}>
                  <Text style={styles.barLabel}>{item.hour}</Text>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        { width: `${(item.visitas / maxVisitas) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.barValue}>{item.visitas}</Text>
                </View>
              ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>Sin visitas registradas hoy</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mi Resumen</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Visitas completadas</Text>
          <Text style={styles.summaryValue}>{stats.completedVisits}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Visitas en curso</Text>
          <Text style={[styles.summaryValue, styles.summaryValueInfo]}>
            {stats.visitsToday - stats.completedVisits}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total cobros pagados</Text>
          <Text style={styles.summaryValue}>
            Gs. {stats.totalCharges.toLocaleString("es-PY")}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowLast]}>
          <Text style={styles.summaryLabel}>Mis clientes</Text>
          <Text style={styles.summaryValue}>{stats.clientsCount}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Actividad Reciente</Text>
        {recentVisits.length === 0 ? (
          <Text style={styles.emptyText}>Sin visitas recientes</Text>
        ) : (
          recentVisits.map((visit) => <RecentVisitRow key={visit.id} visit={visit} />)
        )}
      </View>
    </ScrollView>
  );
}

function RecentVisitRow({ visit }: { visit: Visit }) {
  const isInProgress = !visit.check_out_at;

  return (
    <View style={[styles.visitRow, isInProgress ? styles.visitRowActive : null]}>
      <View style={styles.visitIcon}>
        <Text>Visita</Text>
      </View>
      <View style={styles.visitInfo}>
        <Text style={styles.visitClient}>{visit.client_name}</Text>
        <Text style={styles.visitMeta}>
          {VISIT_TYPE_LABELS[visit.visit_type] || visit.visit_type} •{" "}
          {new Date(visit.check_in_at).toLocaleTimeString("es-PY", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
      <View
        style={[
          styles.badge,
          visit.check_out_at ? styles.badgeSuccess : styles.badgeInfo,
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            visit.check_out_at ? styles.badgeTextSuccess : styles.badgeTextInfo,
          ]}
        >
          {visit.check_out_at ? "OK" : "EN CURSO"}
        </Text>
      </View>
    </View>
  );
}

const s = spacing;
const f = fontSize;
const r = radius;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: s.md, paddingBottom: s.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: {
    fontSize: f["2xl"],
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: s.xs,
  },
  subtitle: {
    fontSize: f.base,
    color: colors.mutedForeground,
    marginBottom: s.md,
  },
  errorBox: {
    backgroundColor: colors.destructiveMuted,
    borderRadius: r.md,
    padding: s.md,
    marginBottom: s.md,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorTitle: {
    fontWeight: "600",
    color: colors.destructive,
    marginBottom: s.xs,
  },
  errorText: { fontSize: f.base, color: colors.destructive },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: s.md,
    marginBottom: s.md,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: colors.card,
    borderRadius: r.md,
    padding: s.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiLabel: {
    fontSize: f.sm,
    color: colors.mutedForeground,
    marginBottom: s.xs,
  },
  kpiValue: {
    fontSize: f.xl,
    fontWeight: "700",
    color: colors.foreground,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: r.md,
    padding: s.md,
    marginBottom: s.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: f.md,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: s.md,
  },
  chart: { gap: s.sm },
  barRow: { flexDirection: "row", alignItems: "center", gap: s.sm },
  barLabel: {
    fontSize: f.xs,
    color: colors.mutedForeground,
    width: 40,
  },
  barContainer: {
    flex: 1,
    height: 24,
    backgroundColor: colors.muted,
    borderRadius: r.sm,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: r.sm,
  },
  barValue: {
    fontSize: f.sm,
    fontWeight: "600",
    width: 24,
  },
  emptyText: {
    fontSize: f.base,
    color: colors.mutedForeground,
    textAlign: "center",
    paddingVertical: s.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: s.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryRowLast: { borderBottomWidth: 0 },
  summaryLabel: { fontSize: f.base, color: colors.mutedForeground },
  summaryValue: {
    fontSize: f.base,
    fontWeight: "600",
    color: colors.foreground,
  },
  summaryValueInfo: {
    color: colors.info,
  },
  visitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: s.md,
    paddingVertical: s.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  visitRowActive: {
    borderColor: colors.info,
    backgroundColor: colors.infoMuted,
    borderRadius: r.md,
    paddingHorizontal: s.sm,
  },
  visitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  visitInfo: { flex: 1 },
  visitClient: {
    fontSize: f.base,
    fontWeight: "600",
    color: colors.foreground,
  },
  visitMeta: { fontSize: f.sm, color: colors.mutedForeground },
  badge: {
    paddingHorizontal: s.sm,
    paddingVertical: s.xs,
    borderRadius: r.full,
  },
  badgeSuccess: { backgroundColor: colors.successMuted },
  badgeInfo: { backgroundColor: colors.infoMuted },
  badgeText: { fontSize: f.sm, fontWeight: "600" },
  badgeTextSuccess: { color: colors.success },
  badgeTextInfo: { color: colors.info },
});
