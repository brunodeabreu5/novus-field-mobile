import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  type CameraRef,
  LineLayer,
  MapView,
  PointAnnotation,
  ShapeSource,
  UserLocation,
  UserLocationRenderMode,
} from "@maplibre/maplibre-react-native";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "../contexts/AuthContext";
import {
  useVendorPositions,
  useVendorPositionsSubscription,
  useVendorsData,
  useVendorRouteHistory,
} from "../hooks/use-mobile-data";
import MapPin from "../components/MapPin";
import { getRuntimeConfigWarnings } from "../lib/config";
import { getMapboxMapStyle } from "../lib/mapbox-tiles";
import { colors } from "../theme/colors";

function formatDuration(minutesOrSeconds: number, unit: "minutes" | "seconds") {
  const totalMinutes =
    unit === "seconds" ? Math.max(1, Math.round(minutesOrSeconds / 60)) : minutesOrSeconds;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} min`;
  }

  return `${hours}h ${minutes}min`;
}

export default function MapScreen() {
  const { isManagerOrAdmin } = useAuth();
  const cameraRef = useRef<CameraRef | null>(null);
  const replayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [historyDate, setHistoryDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayRunning, setReplayRunning] = useState(false);

  const mapboxMapStyle = useMemo(() => getMapboxMapStyle(), []);
  const configWarnings = useMemo(() => getRuntimeConfigWarnings(), []);

  const { data: positions = [], isLoading: isLoadingPositions } =
    useVendorPositions(isManagerOrAdmin);
  const { data: vendors = [] } = useVendorsData(isManagerOrAdmin);
  const {
    data: history,
    isLoading: isLoadingHistory,
  } = useVendorRouteHistory(selectedVendorId || undefined, historyDate || undefined);

  useVendorPositionsSubscription(isManagerOrAdmin);

  const latestByVendor = useMemo(() => {
    return positions.reduce((acc, position) => {
      const current = acc[position.vendor_id];
      if (
        !current ||
        new Date(position.recorded_at).getTime() > new Date(current.recorded_at).getTime()
      ) {
        acc[position.vendor_id] = position;
      }
      return acc;
    }, {} as Record<string, (typeof positions)[number]>);
  }, [positions]);

  const vendorNameById = useMemo(() => {
    return vendors.reduce((acc, vendor) => {
      acc[vendor.user_id] = vendor.full_name || vendor.user_id.slice(0, 8);
      return acc;
    }, {} as Record<string, string>);
  }, [vendors]);

  const liveMarkers = useMemo(
    () =>
      Object.values(latestByVendor).map((position) => ({
        ...position,
        vendorName:
          vendorNameById[position.vendor_id] || position.vendor_id.slice(0, 8),
      })),
    [latestByVendor, vendorNameById]
  );

  const trail = history?.trail || [];
  const historyStats = history?.stats || null;
  const replayPoint = trail[replayIndex] || null;
  const trailLine = useMemo<GeoJSON.Feature<GeoJSON.LineString> | null>(() => {
    if (trail.length < 2) {
      return null;
    }

    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: trail.map((point) => [point.lng, point.lat]),
      },
    };
  }, [trail]);

  useEffect(() => {
    if (!selectedVendorId && vendors.length > 0) {
      setSelectedVendorId(vendors[0].user_id);
    }
  }, [selectedVendorId, vendors]);

  useEffect(() => {
    setReplayIndex(0);
    setReplayRunning(false);
  }, [historyDate, selectedVendorId, trail.length]);

  useEffect(() => {
    if (!trail.length) {
      return;
    }

    const latitudes = trail.map((point) => point.lat);
    const longitudes = trail.map((point) => point.lng);
    const north = Math.max(...latitudes);
    const south = Math.min(...latitudes);
    const east = Math.max(...longitudes);
    const west = Math.min(...longitudes);

    requestAnimationFrame(() => {
      cameraRef.current?.fitBounds([east, north], [west, south], 80, 600);
    });
  }, [trail]);

  useEffect(() => {
    if (!replayRunning || trail.length < 2) {
      if (replayTimerRef.current) {
        clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
      return;
    }

    replayTimerRef.current = setInterval(() => {
      setReplayIndex((current) => {
        if (current >= trail.length - 1) {
          setReplayRunning(false);
          return current;
        }
        return current + 1;
      });
    }, 900);

    return () => {
      if (replayTimerRef.current) {
        clearInterval(replayTimerRef.current);
        replayTimerRef.current = null;
      }
    };
  }, [replayRunning, trail.length]);

  const defaultRegion = {
    latitude: liveMarkers[0]?.latitude ?? -25.2637,
    longitude: liveMarkers[0]?.longitude ?? -57.5759,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  if (!isManagerOrAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Rastreo restringido</Text>
        <Text style={styles.subtitle}>
          El historial y el mapa de movimiento solo estan disponibles para admin y
          manager.
        </Text>
      </View>
    );
  }

  if (isLoadingPositions && !liveMarkers.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.mapCard}>
        <Text style={styles.sectionTitle}>Mapa en vivo</Text>
        <MapView
          style={styles.map}
          mapStyle={mapboxMapStyle}
          scrollEnabled
          zoomEnabled
          pitchEnabled={false}
          rotateEnabled={false}
          attributionEnabled={false}
          logoEnabled={false}
        >
          <Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: [defaultRegion.longitude, defaultRegion.latitude],
              zoomLevel: 10,
            }}
          />
          <UserLocation visible renderMode={UserLocationRenderMode.Normal} />

          {liveMarkers.map((position) => (
            <PointAnnotation
              key={position.id}
              id={`live-${position.id}`}
              coordinate={[position.longitude, position.latitude]}
              title={position.vendorName}
              snippet={new Date(position.recorded_at).toLocaleString("es-PY")}
            >
              <MapPin
                color={colors.primary}
                label={(position.vendorName || "V").slice(0, 1).toUpperCase()}
                size="sm"
              />
            </PointAnnotation>
          ))}

          {trailLine ? (
            <ShapeSource id="trail-source" shape={trailLine}>
              <LineLayer
                id="trail-line"
                style={{
                  lineColor: colors.primary,
                  lineWidth: 4,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            </ShapeSource>
          ) : null}

          {trail[0] ? (
            <PointAnnotation
              id="trail-start"
              coordinate={[trail[0].lng, trail[0].lat]}
              title="Inicio"
            >
              <MapPin color={colors.success} label="I" size="sm" />
            </PointAnnotation>
          ) : null}

          {trail.length > 1 ? (
            <PointAnnotation
              id="trail-end"
              coordinate={[trail[trail.length - 1].lng, trail[trail.length - 1].lat]}
              title="Fin"
            >
              <MapPin color={colors.destructive} label="F" size="sm" />
            </PointAnnotation>
          ) : null}

          {replayPoint ? (
            <PointAnnotation
              id="trail-replay"
              coordinate={[replayPoint.lng, replayPoint.lat]}
              title="Replay"
              snippet={format(replayPoint.timestamp, "dd MMM yyyy HH:mm", {
                locale: es,
              })}
            >
              <MapPin color={colors.warning} label="R" size="sm" />
            </PointAnnotation>
          ) : null}
        </MapView>
        {configWarnings.length ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Revisar configuracion</Text>
            <Text style={styles.warningText}>{configWarnings[0]}</Text>
          </View>
        ) : null}
        <View style={styles.legend}>
          <Text style={styles.legendText}>
            {liveMarkers.length} ubicaciones activas
          </Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Historial de movimiento</Text>
        <Text style={styles.helperText}>
          Solo admin y manager pueden consultar replay y metricas del recorrido.
        </Text>

        <Text style={styles.inputLabel}>Vendedor</Text>
        <View style={styles.chipsWrap}>
          {vendors.map((vendor) => {
            const selected = vendor.user_id === selectedVendorId;
            return (
              <TouchableOpacity
                key={vendor.user_id}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setSelectedVendorId(vendor.user_id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.chipTextSelected,
                  ]}
                >
                  {vendor.full_name || vendor.user_id.slice(0, 8)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.inputLabel}>Fecha</Text>
        <TextInput
          style={styles.input}
          value={historyDate}
          onChangeText={setHistoryDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />

        {isLoadingHistory ? (
          <ActivityIndicator style={styles.loadingInline} color={colors.primary} />
        ) : trail.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sin recorrido</Text>
            <Text style={styles.emptyText}>
              No hay posiciones registradas para la fecha seleccionada.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Distancia</Text>
                <Text style={styles.metricValue}>
                  {historyStats?.totalDistanceKm.toFixed(2)} km
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Vel. media</Text>
                <Text style={styles.metricValue}>
                  {historyStats?.avgSpeedKmh.toFixed(1)} km/h
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Vel. maxima</Text>
                <Text style={styles.metricValue}>
                  {historyStats?.maxSpeedKmh.toFixed(1)} km/h
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Tiempo parado</Text>
                <Text style={styles.metricValue}>
                  {formatDuration(historyStats?.totalIdleTimeSec || 0, "seconds")}
                </Text>
              </View>
            </View>

            <View style={styles.replayCard}>
              <View style={styles.replayHeader}>
                <Text style={styles.replayTitle}>Replay</Text>
                <Text style={styles.replaySubtitle}>
                  Punto {replayIndex + 1} de {trail.length}
                </Text>
              </View>

              <Text style={styles.replayText}>
                {replayPoint
                  ? format(replayPoint.timestamp, "dd MMM yyyy HH:mm:ss", {
                      locale: es,
                    })
                  : "Seleccione un recorrido"}
              </Text>

              <View style={styles.replayActions}>
                <TouchableOpacity
                  style={styles.replayButton}
                  onPress={() =>
                    setReplayIndex((current) => Math.max(0, current - 1))
                  }
                >
                  <Text style={styles.replayButtonText}>Anterior</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.replayButton, styles.replayButtonPrimary]}
                  onPress={() => {
                    if (replayIndex >= trail.length - 1) {
                      setReplayIndex(0);
                    }
                    setReplayRunning((current) => !current);
                  }}
                >
                  <Text style={styles.replayButtonTextPrimary}>
                    {replayRunning ? "Pausar" : "Reproducir"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.replayButton}
                  onPress={() =>
                    setReplayIndex((current) =>
                      Math.min(trail.length - 1, current + 1)
                    )
                  }
                >
                  <Text style={styles.replayButtonText}>Siguiente</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  mapCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  map: {
    width: width - 64,
    height: 300,
    borderRadius: 16,
  },
  legend: {
    marginTop: 12,
    backgroundColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  legendText: {
    fontSize: 14,
    color: colors.mutedForeground,
  },
  warningBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.warningMuted,
    borderRadius: 12,
    padding: 12,
  },
  warningTitle: {
    color: colors.foreground,
    fontWeight: "700",
    marginBottom: 4,
  },
  warningText: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
  },
  panel: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.foreground,
  },
  chipTextSelected: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    color: colors.foreground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  loadingInline: {
    marginVertical: 16,
  },
  emptyCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    width: "47%",
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
  },
  replayCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  replayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  replayTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.foreground,
  },
  replaySubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  replayText: {
    fontSize: 13,
    color: colors.foreground,
    marginBottom: 12,
  },
  replayActions: {
    flexDirection: "row",
    gap: 8,
  },
  replayButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  replayButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  replayButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.foreground,
  },
  replayButtonTextPrimary: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primaryForeground,
  },
});
