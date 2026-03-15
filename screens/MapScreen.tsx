import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import {
  useVendorPositions,
  useVendorPositionsSubscription,
} from "../hooks/use-mobile-data";
import { colors } from "../theme/colors";

export default function MapScreen() {
  const { data: positions = [], isLoading } = useVendorPositions();
  useVendorPositionsSubscription();

  const latestByVendor = positions.reduce((acc, position) => {
    if (!acc[position.vendor_id]) acc[position.vendor_id] = position;
    return acc;
  }, {} as Record<string, (typeof positions)[number]>);
  const markers = Object.values(latestByVendor);

  const defaultRegion = {
    latitude: markers[0]?.latitude ?? -25.2637,
    longitude: markers[0]?.longitude ?? -57.5759,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={defaultRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {markers.map((position) => (
          <Marker
            key={position.id}
            coordinate={{
              latitude: position.latitude,
              longitude: position.longitude,
            }}
            title="Vendedor"
            description={new Date(position.recorded_at).toLocaleString("es-PY")}
          />
        ))}
      </MapView>
      <View style={styles.legend}>
        <Text style={styles.legendText}>{markers.length} ubicaciones en el mapa</Text>
      </View>
    </View>
  );
}

const { width, height } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height: height - 120 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  legend: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendText: { fontSize: 14, color: colors.mutedForeground },
});
