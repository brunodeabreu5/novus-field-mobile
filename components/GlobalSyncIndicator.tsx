import React, { useEffect, useMemo, useState } from "react";
import { AppState, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomSheetModal from "./BottomSheetModal";
import { useTheme } from "../contexts/ThemeContext";
import { offlineStorage, type QueuedAction } from "../lib/offline-storage";
import { syncQueuedActions } from "../lib/sync";
import type { ThemeColors } from "../theme/colors";

type QueueStatusFilter = "all" | "failed" | "waiting";
type QueueTypeFilter = "all" | "visit" | "charge" | "client" | "chat" | "tracking";

function getQueueItemLabel(item: QueuedAction) {
  switch (item.type) {
    case "manual_visit_create":
      return `Visita: ${item.payload.clientName}`;
    case "check_out":
      return `Checkout visita ${item.payload.visitId.slice(0, 8)}`;
    case "client_create":
      return `Cliente: ${item.payload.name}`;
    case "client_update":
      return `Actualizacion cliente: ${item.payload.name}`;
    case "charge_create":
      return `Cobro: ${item.payload.clientName}`;
    case "visit_attachment_upload":
      return `Anexo visita: ${item.payload.fileName}`;
    case "chat_send":
      return `Chat: ${item.payload.message || "mensaje con adjunto"}`;
    case "vendor_position":
      return "Posicion de tracking";
    case "check_in":
      return `Check-in: ${item.payload.clientName}`;
    case "visit_create":
      return `Visita automatica: ${item.payload.clientName}`;
    default:
      return "Accion pendiente";
  }
}

function getQueueItemTypeLabel(item: QueuedAction) {
  switch (item.type) {
    case "manual_visit_create":
      return "Visita";
    case "check_out":
      return "Checkout";
    case "client_create":
    case "client_update":
      return "Cliente";
    case "charge_create":
      return "Cobro";
    case "visit_attachment_upload":
      return "Anexo";
    case "chat_send":
      return "Chat";
    case "vendor_position":
      return "Tracking";
    case "check_in":
      return "Check-in";
    case "visit_create":
      return "Visita auto";
    default:
      return "Pendiente";
  }
}

function getQueueItemStatus(item: QueuedAction, busyActionId: string | null) {
  if (busyActionId === item.id) {
    return {
      label: "Reintentando",
      tone: "info" as const,
    };
  }

  if (item.retries > 0) {
    return {
      label: `Con fallas (${item.retries})`,
      tone: "danger" as const,
    };
  }

  return {
    label: "Aguardando",
    tone: "warning" as const,
  };
}

function buildStyles(colors: ThemeColors, topInset: number) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      top: topInset + 8,
      left: 12,
      right: 12,
      zIndex: 1000,
      alignItems: "center",
      pointerEvents: "box-none",
    },
    badge: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.warningMuted,
      borderWidth: 1,
      borderColor: colors.warning,
      shadowColor: colors.warning,
      shadowOpacity: 0.18,
      shadowRadius: 6,
      elevation: 4,
    },
    text: {
      color: colors.warning,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
    },
    modalContent: {
      maxHeight: "75%",
    },
    helper: {
      color: colors.mutedForeground,
      fontSize: 12,
      marginBottom: 8,
      lineHeight: 18,
    },
    searchInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
      color: colors.foreground,
      backgroundColor: colors.background,
    },
    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },
    filterChip: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    filterChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    filterChipText: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: "600",
    },
    filterChipTextActive: {
      color: colors.primary,
    },
    list: {
      gap: 10,
    },
    itemCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.background,
      padding: 12,
      gap: 6,
    },
    itemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    itemType: {
      color: colors.warning,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    itemStatus: {
      fontSize: 11,
      fontWeight: "700",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: "hidden",
    },
    itemStatusWarning: {
      backgroundColor: colors.warningMuted,
      color: colors.warning,
    },
    itemStatusDanger: {
      backgroundColor: colors.destructiveMuted,
      color: colors.destructive,
    },
    itemStatusInfo: {
      backgroundColor: colors.infoMuted,
      color: colors.info,
    },
    itemRetries: {
      color: colors.mutedForeground,
      fontSize: 12,
    },
    itemLabel: {
      color: colors.foreground,
      fontSize: 14,
      fontWeight: "600",
    },
    itemTimestamp: {
      color: colors.mutedForeground,
      fontSize: 12,
    },
    itemActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4,
    },
    actionButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 8,
      alignItems: "center",
      backgroundColor: colors.card,
    },
    actionButtonPrimary: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    actionButtonDanger: {
      borderColor: colors.destructive,
      backgroundColor: colors.destructiveMuted,
    },
    actionButtonText: {
      color: colors.foreground,
      fontSize: 12,
      fontWeight: "700",
    },
    actionButtonTextPrimary: {
      color: colors.primary,
    },
    actionButtonTextDanger: {
      color: colors.destructive,
    },
  });
}

export default function GlobalSyncIndicator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [pendingCount, setPendingCount] = useState(0);
  const [queueItems, setQueueItems] = useState<QueuedAction[]>([]);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<QueueTypeFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const queue = await offlineStorage.getQueue();
      if (mounted) {
        setPendingCount(queue.length);
        setQueueItems(queue);
      }
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, 4000);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void load();
      }
    });

    return () => {
      mounted = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const refreshQueue = async () => {
    const queue = await offlineStorage.getQueue();
    setPendingCount(queue.length);
    setQueueItems(queue);
  };

  const handleRetryNow = async (item: QueuedAction) => {
    setBusyActionId(item.id);
    try {
      const synced = await syncQueuedActions({ allowedIds: [item.id] });
      await refreshQueue();
      if (synced > 0) {
        Alert.alert("Sincronizado", "El item se sincronizo correctamente.");
      } else {
        Alert.alert("Pendiente", "No se pudo sincronizar ahora. Se reintentara automaticamente.");
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo reintentar la sincronizacion.",
      );
      await refreshQueue();
    } finally {
      setBusyActionId(null);
    }
  };

  const handleRemoveItem = async (item: QueuedAction) => {
    Alert.alert(
      "Quitar de la fila",
      "Este item ya no se sincronizara automaticamente. Desea continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Quitar",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusyActionId(item.id);
              try {
                await offlineStorage.removeFromQueue(item.id);
                await refreshQueue();
              } finally {
                setBusyActionId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const styles = buildStyles(colors, insets.top);
  const sortedItems = useMemo(
    () => [...queueItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [queueItems],
  );
  const filteredItems = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return sortedItems.filter((item) => {
      if (statusFilter === "failed" && item.retries <= 0) {
        return false;
      }

      if (statusFilter === "waiting" && item.retries > 0) {
        return false;
      }

      const typeMatches =
        typeFilter === "all"
          ? true
          : typeFilter === "visit"
            ? ["visit_create", "manual_visit_create", "check_in", "check_out", "visit_attachment_upload"].includes(item.type)
            : typeFilter === "charge"
              ? item.type === "charge_create"
              : typeFilter === "client"
                ? item.type === "client_create" || item.type === "client_update"
                : typeFilter === "chat"
                  ? item.type === "chat_send"
                  : item.type === "vendor_position";

      if (!typeMatches) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      const label = getQueueItemLabel(item).toLowerCase();
      const typeLabel = getQueueItemTypeLabel(item).toLowerCase();
      return label.includes(searchTerm) || typeLabel.includes(searchTerm);
    });
  }, [search, sortedItems, statusFilter, typeFilter]);

  if (pendingCount <= 0) {
    return null;
  }

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity style={styles.badge} onPress={() => setDetailsVisible(true)}>
          <Text style={styles.text}>
            {pendingCount} item{pendingCount === 1 ? "" : "s"} pendiente{pendingCount === 1 ? "" : "s"} de sync
          </Text>
        </TouchableOpacity>
      </View>

      <BottomSheetModal
        visible={detailsVisible}
        title="Pendientes de sincronizacion"
        onRequestClose={() => setDetailsVisible(false)}
        contentStyle={styles.modalContent}
      >
        <Text style={styles.helper}>
          Estos cambios se enviaran automaticamente cuando la conexion este disponible.
        </Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por cliente, visita, archivo o mensaje"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.filterRow}>
          {[
            ["all", "Todos"],
            ["failed", "Con fallas"],
            ["waiting", "Aguardando"],
          ].map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[styles.filterChip, statusFilter === value ? styles.filterChipActive : null]}
              onPress={() => setStatusFilter(value as QueueStatusFilter)}
            >
              <Text style={[styles.filterChipText, statusFilter === value ? styles.filterChipTextActive : null]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.filterRow}>
          {[
            ["all", "Todos"],
            ["visit", "Visitas"],
            ["charge", "Cobros"],
            ["client", "Clientes"],
            ["chat", "Chat"],
            ["tracking", "Tracking"],
          ].map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[styles.filterChip, typeFilter === value ? styles.filterChipActive : null]}
              onPress={() => setTypeFilter(value as QueueTypeFilter)}
            >
              <Text style={[styles.filterChipText, typeFilter === value ? styles.filterChipTextActive : null]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.list}>
          {filteredItems.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              {(() => {
                const status = getQueueItemStatus(item, busyActionId);
                return (
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemType}>{getQueueItemTypeLabel(item)}</Text>
                    <Text
                      style={[
                        styles.itemStatus,
                        status.tone === "danger"
                          ? styles.itemStatusDanger
                          : status.tone === "info"
                            ? styles.itemStatusInfo
                            : styles.itemStatusWarning,
                      ]}
                    >
                      {status.label}
                    </Text>
                  </View>
                );
              })()}
              <View style={styles.itemHeader}>
                <Text style={styles.itemRetries}>Reintentos: {item.retries}</Text>
              </View>
              <Text style={styles.itemLabel} numberOfLines={2}>
                {getQueueItemLabel(item)}
              </Text>
              <Text style={styles.itemTimestamp}>
                {new Date(item.createdAt).toLocaleString("es-PY")}
              </Text>
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                  onPress={() => void handleRetryNow(item)}
                  disabled={busyActionId === item.id}
                >
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                    {busyActionId === item.id ? "Reintentando..." : "Reintentar ahora"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonDanger]}
                  onPress={() => handleRemoveItem(item)}
                  disabled={busyActionId === item.id}
                >
                  <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
                    Quitar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {filteredItems.length === 0 ? (
            <Text style={styles.helper}>No hay items para este filtro.</Text>
          ) : null}
        </View>
      </BottomSheetModal>
    </>
  );
}
