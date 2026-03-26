import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../theme/colors";
import { spacing, fontSize, radius } from "../theme/spacing";
import { reportsData, VendorPerformance, ClientCoverage, AIAnalysis } from "../lib/data/reports-data";

type ReportTab = "performance" | "coverage" | "ai";

export default function ReportsScreen() {
  const { user, isManagerOrAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>("performance");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [performance, setPerformance] = useState<VendorPerformance | null>(null);
  const [coverage, setCoverage] = useState<ClientCoverage | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      if (activeTab === "performance") {
        if (!user?.id) {
          throw new Error("Sesion no disponible");
        }

        const data = await reportsData.getVendorPerformance(user.id, "30d");
        setPerformance(data);
      } else if (activeTab === "coverage") {
        const data = await reportsData.getClientCoverage(30);
        setCoverage(data);
      } else if (activeTab === "ai" && isManagerOrAdmin) {
        const data = await reportsData.getAIAnalysis();
        setAiAnalysis(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    }
  }, [activeTab, isManagerOrAdmin, user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData().finally(() => setLoading(false));
    }, [fetchData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const tabs: { key: ReportTab; label: string }[] = [
    { key: "performance", label: "Rendimiento" },
    { key: "coverage", label: "Cobertura" },
    ...(isManagerOrAdmin ? [{ key: "ai" as const, label: "IA" }] : []),
  ];

  const renderPerformance = () => {
    if (!performance) return null;
    return (
      <View style={styles.content}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{performance.totalVisits}</Text>
            <Text style={styles.kpiLabel}>Visitas</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{performance.completedVisits}</Text>
            <Text style={styles.kpiLabel}>Completadas</Text>
          </View>
        </View>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{performance.totalClients}</Text>
            <Text style={styles.kpiLabel}>Clientes</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{performance.activeClients}</Text>
            <Text style={styles.kpiLabel}>Activos</Text>
          </View>
        </View>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{performance.totalCharges}</Text>
            <Text style={styles.kpiLabel}>Cargos</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{performance.pendingCharges}</Text>
            <Text style={styles.kpiLabel}>Pendientes</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderCoverage = () => {
    if (!coverage) return null;
    return (
      <View style={styles.content}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{coverage.totalClients}</Text>
            <Text style={styles.kpiLabel}>Total</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{coverage.activeClients}</Text>
            <Text style={styles.kpiLabel}>Activos</Text>
          </View>
        </View>
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, styles.kpiCardWarning]}>
            <Text style={styles.kpiValue}>{coverage.inactiveClients}</Text>
            <Text style={styles.kpiLabel}>Inactivos</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{coverage.unvisitedClients}</Text>
            <Text style={styles.kpiLabel}>Sin visita</Text>
          </View>
        </View>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{coverage.newClients}</Text>
            <Text style={styles.kpiLabel}>Nuevos</Text>
          </View>
        </View>
        {coverage.clients.slice(0, 8).map((client) => (
          <View key={client.id} style={styles.clientRow}>
            <View style={styles.clientRowText}>
              <Text style={styles.clientName}>{client.name}</Text>
              <Text style={styles.clientMeta}>
                {client.assignedVendor || "Sin vendedor"}
                {client.daysSinceLastVisit != null
                  ? ` · ${client.daysSinceLastVisit} dia(s) sem visita`
                  : " · Sin visitas"}
              </Text>
            </View>
            <View
              style={[
                styles.clientStatusBadge,
                client.status === "inactive"
                  ? styles.clientStatusWarning
                  : client.status === "active"
                    ? styles.clientStatusSuccess
                    : styles.clientStatusInfo,
              ]}
            >
              <Text style={styles.clientStatusText}>{client.status}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderAI = () => {
    if (!aiAnalysis) return null;
    return (
      <ScrollView style={styles.content}>
        <View style={styles.aiCard}>
          <Text style={styles.aiTitle}>Resumen</Text>
          <Text style={styles.aiText}>{aiAnalysis.summary}</Text>
        </View>
        {aiAnalysis.insights.map((insight, index) => (
          <View
            key={index}
            style={[
              styles.aiCard,
              insight.type === "success" && styles.aiCardSuccess,
              insight.type === "warning" && styles.aiCardWarning,
              insight.type === "info" && styles.aiCardInfo,
            ]}
          >
            <Text style={styles.aiInsightTitle}>{insight.title}</Text>
            <Text style={styles.aiText}>{insight.description}</Text>
          </View>
        ))}
        <View style={styles.aiCard}>
          <Text style={styles.aiTitle}>Recomendaciones</Text>
          {aiAnalysis.recommendations.map((rec, index) => (
            <Text key={index} style={styles.aiText}>• {rec}</Text>
          ))}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reportes</Text>
      </View>
      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {activeTab === "performance" && renderPerformance()}
          {activeTab === "coverage" && renderCoverage()}
          {activeTab === "ai" && isManagerOrAdmin && renderAI()}
        </ScrollView>
      )}
    </View>
  );
}

const s = spacing;
const f = fontSize;
const r = radius;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: s.lg,
    backgroundColor: colors.primary,
    paddingTop: s.xl + s.lg,
  },
  headerTitle: {
    fontSize: f["2xl"],
    fontWeight: "700",
    color: colors.primaryForeground,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: s.md,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: f.base,
    color: colors.mutedForeground,
    fontWeight: "500",
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: "600",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: s.lg,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: s.lg,
  },
  errorText: {
    color: colors.destructive,
    fontSize: f.base,
    textAlign: "center",
    marginBottom: s.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: s.lg,
    paddingVertical: s.sm,
    borderRadius: r.md,
  },
  retryText: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
  kpiRow: {
    flexDirection: "row",
    marginBottom: s.md,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.card,
    padding: s.lg,
    borderRadius: r.md,
    marginHorizontal: s.xs,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  kpiCardWarning: {
    backgroundColor: colors.warningMuted,
  },
  kpiValue: {
    fontSize: f["2xl"],
    fontWeight: "700",
    color: colors.foreground,
  },
  kpiLabel: {
    fontSize: f.sm,
    color: colors.mutedForeground,
    marginTop: s.xs,
  },
  aiCard: {
    backgroundColor: colors.card,
    padding: s.lg,
    borderRadius: r.md,
    marginBottom: s.md,
  },
  aiCardSuccess: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  aiCardWarning: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  aiCardInfo: {
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  aiTitle: {
    fontSize: f.lg,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: s.sm,
  },
  aiInsightTitle: {
    fontSize: f.base,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: s.xs,
  },
  aiText: {
    fontSize: f.base,
    color: colors.mutedForeground,
    lineHeight: f.base * 1.5,
  },
  clientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: s.md,
    marginBottom: s.sm,
  },
  clientRowText: {
    flex: 1,
    paddingRight: s.sm,
  },
  clientName: {
    fontSize: f.base,
    fontWeight: "600",
    color: colors.foreground,
  },
  clientMeta: {
    fontSize: f.sm,
    color: colors.mutedForeground,
    marginTop: s.xs,
  },
  clientStatusBadge: {
    paddingHorizontal: s.sm,
    paddingVertical: s.xs,
    borderRadius: 999,
  },
  clientStatusSuccess: {
    backgroundColor: colors.successMuted,
  },
  clientStatusWarning: {
    backgroundColor: colors.warningMuted,
  },
  clientStatusInfo: {
    backgroundColor: colors.infoMuted,
  },
  clientStatusText: {
    fontSize: f.sm,
    fontWeight: "700",
    color: colors.foreground,
    textTransform: "capitalize",
  },
});
