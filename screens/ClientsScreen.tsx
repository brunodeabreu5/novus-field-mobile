import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import MapView, {
  Marker,
  type MarkerDragStartEndEvent,
  type Region,
} from "react-native-maps";
import { useAuth } from "../contexts/AuthContext";
import {
  useClientsData,
  useCreateClient,
  useUpdateClient,
} from "../hooks/use-mobile-data";
import { useDevicePermissions } from "../contexts/DevicePermissionsContext";
import type { Client } from "../lib/mobile-data";
import BottomSheetModal from "../components/BottomSheetModal";
import FormActions from "../components/FormActions";
import FormField from "../components/FormField";
import { colors } from "../theme/colors";

const isValidEmail = (email: string): boolean => {
  if (!email.trim()) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhone = (phone: string): boolean => {
  if (!phone.trim()) return true;
  const phoneRegex = /^[\d\s+\-()]{8,20}$/;
  return phoneRegex.test(phone);
};

const emptyForm = {
  name: "",
  document: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  latitude: "",
  longitude: "",
};

const DEFAULT_REGION: Region = {
  latitude: -25.2637,
  longitude: -57.5759,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const formatCoordinate = (value: number | null) => {
  if (value === null) {
    return "";
  }

  return value.toFixed(6);
};

const buildClientForm = (client: Client) => ({
  name: client.name ?? "",
  document: client.document ?? "",
  phone: client.phone ?? "",
  email: client.email ?? "",
  address: client.address ?? "",
  notes: client.notes ?? "",
  latitude: formatCoordinate(client.latitude),
  longitude: formatCoordinate(client.longitude),
});

const buildRegionFromClient = (client: Client): Region => ({
  latitude: client.latitude ?? DEFAULT_REGION.latitude,
  longitude: client.longitude ?? DEFAULT_REGION.longitude,
  latitudeDelta: DEFAULT_REGION.latitudeDelta,
  longitudeDelta: DEFAULT_REGION.longitudeDelta,
});

async function resolveCurrentLocation() {
  try {
    const lastKnown = await Location.getLastKnownPositionAsync({});
    if (lastKnown) {
      return lastKnown;
    }
  } catch {
    // Ignore and fall back to a live fix.
  }

  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  } catch {
    return null;
  }
}

export default function ClientsScreen() {
  const { user } = useAuth();
  const { data: clients = [], isLoading } = useClientsData();
  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();
  const {
    locationPermission,
    requestLocationPermission,
  } = useDevicePermissions();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [addressSearching, setAddressSearching] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [pickerRegion, setPickerRegion] = useState<Region>(DEFAULT_REGION);

  const filtered = useMemo(
    () =>
      clients.filter(
        (client) =>
          !search.trim() ||
          client.name.toLowerCase().includes(search.toLowerCase()) ||
          (client.phone || "").toLowerCase().includes(search.toLowerCase()) ||
          (client.email || "").toLowerCase().includes(search.toLowerCase()) ||
          (client.address || "").toLowerCase().includes(search.toLowerCase())
      ),
    [clients, search]
  );

  const openModal = () => {
    setEditingClient(null);
    setForm(emptyForm);
    setPickerRegion(DEFAULT_REGION);
    setModalVisible(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setForm(buildClientForm(client));
    setPickerRegion(buildRegionFromClient(client));
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingClient(null);
    setForm(emptyForm);
    setPickerRegion(DEFAULT_REGION);
  };

  const updateLocation = (
    latitude: number,
    longitude: number,
    nextAddress?: string
  ) => {
    setForm((current) => ({
      ...current,
      address: nextAddress ?? current.address,
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
    }));
    setPickerRegion((current) => ({
      latitude,
      longitude,
      latitudeDelta: current.latitudeDelta || DEFAULT_REGION.latitudeDelta,
      longitudeDelta: current.longitudeDelta || DEFAULT_REGION.longitudeDelta,
    }));
  };

  const loadInitialPickerLocation = async () => {
    if (!modalVisible) {
      return;
    }

    if (form.latitude.trim() && form.longitude.trim()) {
      const latitude = Number.parseFloat(form.latitude);
      const longitude = Number.parseFloat(form.longitude);
      if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
        setPickerRegion((current) => ({
          latitude,
          longitude,
          latitudeDelta: current.latitudeDelta || DEFAULT_REGION.latitudeDelta,
          longitudeDelta:
            current.longitudeDelta || DEFAULT_REGION.longitudeDelta,
        }));
        return;
      }
    }

    try {
      let currentPermission = locationPermission;
      if (currentPermission !== "granted") {
        await requestLocationPermission();
        const { status } = await Location.getForegroundPermissionsAsync();
        currentPermission = status === "granted" ? "granted" : "denied";
      }

      if (currentPermission !== "granted") {
        setPickerRegion(DEFAULT_REGION);
        return;
      }

      const position = await resolveCurrentLocation();
      if (!position) {
        setPickerRegion(DEFAULT_REGION);
        return;
      }

      updateLocation(position.coords.latitude, position.coords.longitude);
    } catch {
      setPickerRegion(DEFAULT_REGION);
    }
  };

  React.useEffect(() => {
    void loadInitialPickerLocation();
  }, [modalVisible]);

  const handleGetGPS = async () => {
    if (!user) {
      return;
    }

    setGpsLoading(true);

    try {
      let currentPermission = locationPermission;
      if (currentPermission !== "granted") {
        await requestLocationPermission();
        const { status } = await Location.getForegroundPermissionsAsync();
        currentPermission = status === "granted" ? "granted" : "denied";
      }

      if (currentPermission !== "granted") {
        Alert.alert(
          "GPS no disponible",
          "Debe permitir acceso a la ubicacion para capturar el punto del cliente."
        );
        return;
      }

      const position = await resolveCurrentLocation();

      if (!position) {
        Alert.alert(
          "GPS no disponible",
          "No se pudo obtener una ubicacion ahora. Puede mover el pin manualmente."
        );
        return;
      }

      updateLocation(position.coords.latitude, position.coords.longitude);
    } catch (error) {
      Alert.alert(
        "Error GPS",
        error instanceof Error
          ? error.message
          : "No se pudo obtener la ubicacion actual"
      );
    } finally {
      setGpsLoading(false);
    }
  };

  const handleAddressSearch = async () => {
    if (!form.address.trim() || form.address.trim().length < 3) {
      Alert.alert(
        "Direccion requerida",
        "Ingrese una direccion mas completa para buscar coordenadas."
      );
      return;
    }

    setAddressSearching(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          form.address.trim()
        )}&limit=1`
      );
      const data = (await response.json()) as Array<{
        lat: string;
        lon: string;
        display_name?: string;
      }>;

      if (!data || data.length === 0) {
        Alert.alert(
          "Direccion no encontrada",
          "No fue posible encontrar coordenadas para esta direccion."
        );
        return;
      }

      updateLocation(
        Number.parseFloat(data[0].lat),
        Number.parseFloat(data[0].lon),
        data[0].display_name
      );
    } catch (error) {
      Alert.alert(
        "Error buscando direccion",
        error instanceof Error
          ? error.message
          : "No se pudo buscar la direccion"
      );
    } finally {
      setAddressSearching(false);
    }
  };

  const handleSaveClient = async () => {
    if (!user || !form.name.trim()) {
      Alert.alert("Error", "El nombre es obligatorio");
      return;
    }

    if (!isValidEmail(form.email)) {
      Alert.alert("Error", "Formato de email invalido");
      return;
    }

    if (!isValidPhone(form.phone)) {
      Alert.alert("Error", "Formato de telefono invalido");
      return;
    }

    const latitude = form.latitude.trim()
      ? Number.parseFloat(form.latitude.trim())
      : null;
    const longitude = form.longitude.trim()
      ? Number.parseFloat(form.longitude.trim())
      : null;

    if ((latitude === null) !== (longitude === null)) {
      Alert.alert(
        "Ubicacion incompleta",
        "Latitude y longitude deben estar completas o vacias."
      );
      return;
    }

    if (
      latitude !== null &&
      (Number.isNaN(latitude) || longitude === null || Number.isNaN(longitude))
    ) {
      Alert.alert("Error", "Las coordenadas del cliente no son validas.");
      return;
    }

    try {
      if (editingClient) {
        await updateClientMutation.mutateAsync({
          userId: user.id,
          client: editingClient,
          name: form.name,
          document: form.document,
          phone: form.phone,
          email: form.email,
          address: form.address,
          notes: form.notes,
          latitude,
          longitude,
        });
      } else {
        await createClientMutation.mutateAsync({
          userId: user.id,
          name: form.name,
          document: form.document,
          phone: form.phone,
          email: form.email,
          address: form.address,
          notes: form.notes,
          latitude,
          longitude,
        });
      }
      closeModal();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo guardar el cliente"
      );
    }
  };

  const handleMarkerDragEnd = (event: MarkerDragStartEndEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    updateLocation(latitude, longitude);
  };

  const selectedCoordinate =
    form.latitude.trim() && form.longitude.trim()
      ? {
          latitude: Number.parseFloat(form.latitude),
          longitude: Number.parseFloat(form.longitude),
        }
      : null;

  const renderClient = ({ item }: { item: Client }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.name}</Text>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
          <Text style={styles.editBtnText}>Editar</Text>
        </TouchableOpacity>
      </View>
      {item.phone ? <Text style={styles.meta}>Tel: {item.phone}</Text> : null}
      {item.document ? <Text style={styles.meta}>RUC/DOC: {item.document}</Text> : null}
      {item.address ? (
        <Text style={styles.meta} numberOfLines={1}>
          Dir: {item.address}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.search}
          placeholder="Buscar clientes..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.mutedForeground}
        />
        <TouchableOpacity style={styles.addBtn} onPress={openModal}>
          <Text style={styles.addBtnText}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderClient}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Sin clientes</Text>}
        />
      )}

      <BottomSheetModal
        visible={modalVisible}
        title={editingClient ? "Editar Cliente" : "Nuevo Cliente"}
        onRequestClose={closeModal}
        contentStyle={styles.modal}
      >
        <FormField
          label="Nombre *"
          placeholder="Nombre del cliente"
          value={form.name}
          onChangeText={(text) => setForm((current) => ({ ...current, name: text }))}
        />
        <FormField
          label="RUC / DOC"
          placeholder="Ingrese RUC o documento"
          value={form.document}
          onChangeText={(text) =>
            setForm((current) => ({ ...current, document: text }))
          }
        />
        <FormField
          label="Telefono"
          placeholder="Telefono"
          value={form.phone}
          onChangeText={(text) => setForm((current) => ({ ...current, phone: text }))}
          keyboardType="phone-pad"
        />
        <FormField
          label="Email"
          placeholder="Email"
          value={form.email}
          onChangeText={(text) => setForm((current) => ({ ...current, email: text }))}
          keyboardType="email-address"
        />
        <FormField
          label="Direccion"
          placeholder="Direccion"
          value={form.address}
          onChangeText={(text) =>
            setForm((current) => ({ ...current, address: text }))
          }
        />

        <View style={styles.locationActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryAction]}
            onPress={handleGetGPS}
            disabled={
              gpsLoading ||
              createClientMutation.isPending ||
              updateClientMutation.isPending
            }
          >
            <Text style={styles.primaryActionText}>
              {gpsLoading ? "Obteniendo GPS..." : "Usar mi ubicacion"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleAddressSearch}
            disabled={
              addressSearching ||
              createClientMutation.isPending ||
              updateClientMutation.isPending
            }
          >
            <Text style={styles.actionText}>
              {addressSearching ? "Buscando..." : "Buscar por direccion"}
            </Text>
          </TouchableOpacity>
        </View>

        {form.latitude && form.longitude ? (
          <View style={styles.mapWrapper}>
            <MapView
              style={styles.map}
              region={pickerRegion}
              onRegionChangeComplete={setPickerRegion}
              scrollEnabled
              zoomEnabled
            >
              {selectedCoordinate ? (
                <Marker
                  coordinate={selectedCoordinate}
                  draggable
                  onDragEnd={handleMarkerDragEnd}
                  pinColor={colors.primary}
                />
              ) : null}
            </MapView>
            <Text style={styles.coordinatesLabel}>
              Mueva el pin para ajustar la ubicacion exacta del cliente.
            </Text>
            <Text style={styles.coordinatesValue}>
              Punto seleccionado: {form.latitude}, {form.longitude}
            </Text>
          </View>
        ) : (
          <View style={styles.mapWrapper}>
            <MapView
              style={styles.map}
              region={pickerRegion}
              onRegionChangeComplete={setPickerRegion}
              scrollEnabled
              zoomEnabled
            />
            <Text style={styles.coordinatesLabel}>
              Use GPS o busque por direccion para colocar el pin del cliente.
            </Text>
          </View>
        )}
        <FormField
          label="Notas"
          placeholder="Observaciones del cliente"
          value={form.notes}
          onChangeText={(text) => setForm((current) => ({ ...current, notes: text }))}
          multiline
        />

        <FormActions
          isLoading={createClientMutation.isPending || updateClientMutation.isPending}
          submitLabel={editingClient ? "Actualizar" : "Guardar"}
          onCancel={closeModal}
          onSubmit={handleSaveClient}
        />
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  search: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.foreground,
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  addBtnText: { color: "#fff", fontWeight: "600" },
  loader: { marginTop: 32 },
  list: { padding: 16, paddingBottom: 32 },
  empty: { textAlign: "center", color: colors.mutedForeground, marginTop: 32 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  name: { fontSize: 16, fontWeight: "600", color: colors.foreground, flex: 1 },
  meta: { fontSize: 13, color: colors.mutedForeground, marginTop: 4 },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  editBtnText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "600",
  },
  modal: {
    maxHeight: "90%",
  },
  locationActions: {
    gap: 10,
    marginBottom: 12,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  primaryAction: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionText: {
    color: colors.foreground,
    fontWeight: "600",
  },
  primaryActionText: {
    color: colors.primaryForeground,
    fontWeight: "600",
  },
  coordinatesBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  mapWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  map: {
    height: 220,
    borderRadius: 12,
    marginBottom: 10,
  },
  coordinatesLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginBottom: 4,
  },
  coordinatesValue: {
    color: colors.foreground,
    fontWeight: "600",
    fontSize: 13,
  },
});
