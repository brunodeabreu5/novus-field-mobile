import React, { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Camera,
  type CameraRef,
  MapView,
  PointAnnotation,
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
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
import MapPin from "../components/MapPin";
import { getRuntimeConfigWarnings } from "../lib/config";
import { geocodeAddress } from "../lib/geocoding";
import { getMapTokenWarning, getMapboxMapStyle } from "../lib/mapbox-tiles";
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

const normalizeName = (value: string) => value.replace(/\s+/g, " ").trim();
const normalizeDocument = (value: string) => value.replace(/\s+/g, " ").trim().toUpperCase();
const normalizePhone = (value: string) =>
  value.replace(/[^\d\s+\-()]/g, "").replace(/\s+/g, " ").trim();
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeAddress = (value: string) => value.replace(/\s+/g, " ").trim();

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

const DEFAULT_ZOOM_LEVEL = 14;

const DEFAULT_VIEWPORT = {
  latitude: -25.2637,
  longitude: -57.5759,
  zoomLevel: 14,
};

type PickerViewport = typeof DEFAULT_VIEWPORT;

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

const buildViewportFromClient = (client: Client): PickerViewport => ({
  latitude: client.latitude ?? DEFAULT_VIEWPORT.latitude,
  longitude: client.longitude ?? DEFAULT_VIEWPORT.longitude,
  zoomLevel: DEFAULT_ZOOM_LEVEL,
});

function extractCoordinateFromFeature(feature?: GeoJSON.Feature | null) {
  if (feature?.geometry?.type !== "Point") {
    return null;
  }

  const [longitude, latitude] = feature.geometry.coordinates;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return { latitude, longitude };
}

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
  const cameraRef = useRef<CameraRef | null>(null);
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
  const [pickerViewport, setPickerViewport] = useState<PickerViewport>(DEFAULT_VIEWPORT);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const mapboxMapStyle = useMemo(() => getMapboxMapStyle(), []);
  const mapWarnings = useMemo(() => {
    const warnings = [...getRuntimeConfigWarnings()];
    const tokenWarning = getMapTokenWarning();
    if (tokenWarning) {
      warnings.push(tokenWarning);
    }
    return warnings;
  }, []);

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
    setPickerViewport(DEFAULT_VIEWPORT);
    setTouched({});
    setModalVisible(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setForm(buildClientForm(client));
    setPickerViewport(buildViewportFromClient(client));
    setTouched({});
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingClient(null);
    setForm(emptyForm);
    setPickerViewport(DEFAULT_VIEWPORT);
    setTouched({});
  };

  const markTouched = (field: string) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const fieldErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    const normalizedName = normalizeName(form.name);
    const normalizedAddress = normalizeAddress(form.address);
    const normalizedEmail = normalizeEmail(form.email);
    const normalizedPhone = normalizePhone(form.phone);
    const latitude = form.latitude.trim() ? Number.parseFloat(form.latitude.trim()) : null;
    const longitude = form.longitude.trim() ? Number.parseFloat(form.longitude.trim()) : null;

    if (!normalizedName) {
      errors.name = "El nombre es obligatorio.";
    }

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      errors.email = "Ingrese un email valido.";
    }

    if (normalizedPhone && !isValidPhone(normalizedPhone)) {
      errors.phone = "Ingrese un telefono valido.";
    }

    if (normalizedAddress && normalizedAddress.length < 3) {
      errors.address = "Ingrese una direccion mas completa.";
    }

    if ((latitude === null) !== (longitude === null)) {
      errors.location = "Latitud y longitud deben completarse juntas.";
    } else if (
      latitude !== null &&
      (Number.isNaN(latitude) || longitude === null || Number.isNaN(longitude))
    ) {
      errors.location = "Las coordenadas no son validas.";
    }

    return errors;
  }, [form.address, form.email, form.latitude, form.longitude, form.name, form.phone]);

  const hasLocation = !!(form.latitude && form.longitude);

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
    setPickerViewport((current) => ({
      latitude,
      longitude,
      zoomLevel: current.zoomLevel || DEFAULT_ZOOM_LEVEL,
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
        setPickerViewport((current) => ({
          latitude,
          longitude,
          zoomLevel: current.zoomLevel || DEFAULT_ZOOM_LEVEL,
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
        setPickerViewport(DEFAULT_VIEWPORT);
        return;
      }

      const position = await resolveCurrentLocation();
      if (!position) {
        setPickerViewport(DEFAULT_VIEWPORT);
        return;
      }

      updateLocation(position.coords.latitude, position.coords.longitude);
    } catch {
      setPickerViewport(DEFAULT_VIEWPORT);
    }
  };

  useEffect(() => {
    void loadInitialPickerLocation();
  }, [modalVisible]);

  useEffect(() => {
    if (!modalVisible) {
      return;
    }

    cameraRef.current?.setCamera({
      centerCoordinate: [pickerViewport.longitude, pickerViewport.latitude],
      zoomLevel: pickerViewport.zoomLevel,
      animationDuration: 250,
    });
  }, [modalVisible, pickerViewport]);

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
    const normalizedAddress = normalizeAddress(form.address);

    if (!normalizedAddress || normalizedAddress.length < 3) {
      markTouched("address");
      Alert.alert(
        "Direccion requerida",
        "Ingrese una direccion mas completa para buscar coordenadas."
      );
      return;
    }

    setAddressSearching(true);

    try {
      const result = await geocodeAddress(normalizedAddress);
      updateLocation(result.latitude, result.longitude, result.displayName);
    } catch (error) {
      if (error instanceof Error && error.message === "Address not found") {
        Alert.alert(
          "Direccion no encontrada",
          "No fue posible encontrar coordenadas para esta direccion."
        );
        return;
      }

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
    const normalizedName = normalizeName(form.name);
    const normalizedDocument = normalizeDocument(form.document);
    const normalizedPhone = normalizePhone(form.phone);
    const normalizedEmail = normalizeEmail(form.email);
    const normalizedAddress = normalizeAddress(form.address);
    const normalizedNotes = form.notes.trim();

    if (!user || !normalizedName) {
      markTouched("name");
      Alert.alert("Error", "El nombre es obligatorio");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      markTouched("email");
      Alert.alert("Error", "Formato de email invalido");
      return;
    }

    if (!isValidPhone(normalizedPhone)) {
      markTouched("phone");
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
      markTouched("location");
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
      markTouched("location");
      Alert.alert("Error", "Las coordenadas del cliente no son validas.");
      return;
    }

    try {
      if (editingClient) {
        await updateClientMutation.mutateAsync({
          userId: user.id,
          client: editingClient,
          name: normalizedName,
          document: normalizedDocument,
          phone: normalizedPhone,
          email: normalizedEmail,
          address: normalizedAddress,
          notes: normalizedNotes,
          latitude,
          longitude,
        });
      } else {
        await createClientMutation.mutateAsync({
          userId: user.id,
          name: normalizedName,
          document: normalizedDocument,
          phone: normalizedPhone,
          email: normalizedEmail,
          address: normalizedAddress,
          notes: normalizedNotes,
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

  const handleMarkerDragEnd = (feature: GeoJSON.Feature) => {
    const coordinate = extractCoordinateFromFeature(feature);
    if (!coordinate) {
      return;
    }

    updateLocation(coordinate.latitude, coordinate.longitude);
  };

  const handleMapPress = (feature: GeoJSON.Feature) => {
    const coordinate = extractCoordinateFromFeature(feature);
    if (!coordinate) {
      return;
    }

    updateLocation(coordinate.latitude, coordinate.longitude);
  };

  const selectedCoordinate =
    form.latitude.trim() && form.longitude.trim()
      ? ([Number.parseFloat(form.longitude), Number.parseFloat(form.latitude)] as [
          number,
          number,
        ])
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
          onBlur={() => {
            markTouched("name");
            setForm((current) => ({ ...current, name: normalizeName(current.name) }));
          }}
          error={touched.name ? fieldErrors.name : null}
        />
        <FormField
          label="RUC / DOC"
          placeholder="Ingrese RUC o documento"
          value={form.document}
          onChangeText={(text) =>
            setForm((current) => ({ ...current, document: text }))
          }
          onBlur={() =>
            setForm((current) => ({ ...current, document: normalizeDocument(current.document) }))
          }
        />
        <FormField
          label="Telefono"
          placeholder="Telefono"
          value={form.phone}
          onChangeText={(text) => setForm((current) => ({ ...current, phone: text }))}
          keyboardType="phone-pad"
          onBlur={() => {
            markTouched("phone");
            setForm((current) => ({ ...current, phone: normalizePhone(current.phone) }));
          }}
          error={touched.phone ? fieldErrors.phone : null}
          helpText={!touched.phone ? "Puede dejarlo vacio si no lo tiene." : null}
        />
        <FormField
          label="Email"
          placeholder="Email"
          value={form.email}
          onChangeText={(text) => setForm((current) => ({ ...current, email: text }))}
          keyboardType="email-address"
          autoCapitalize="none"
          onBlur={() => {
            markTouched("email");
            setForm((current) => ({ ...current, email: normalizeEmail(current.email) }));
          }}
          error={touched.email ? fieldErrors.email : null}
        />
        <FormField
          label="Direccion"
          placeholder="Direccion"
          value={form.address}
          onChangeText={(text) =>
            setForm((current) => ({ ...current, address: text }))
          }
          onBlur={() => {
            markTouched("address");
            setForm((current) => ({ ...current, address: normalizeAddress(current.address) }));
          }}
          error={touched.address ? fieldErrors.address : null}
          helpText={!hasLocation ? "Use GPS, el mapa o la busqueda por direccion para fijar la ubicacion." : null}
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

        {mapWarnings.length ? (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Revisar configuracion del mapa</Text>
            <Text style={styles.warningText}>{mapWarnings[0]}</Text>
          </View>
        ) : null}

        {form.latitude && form.longitude ? (
          <View style={styles.mapWrapper}>
            <MapView
              style={styles.map}
              mapStyle={mapboxMapStyle}
              onPress={handleMapPress}
              scrollEnabled
              zoomEnabled
              pitchEnabled={false}
              rotateEnabled={false}
              logoEnabled={false}
              attributionEnabled={false}
            >
              <Camera
                ref={cameraRef}
                defaultSettings={{
                  centerCoordinate: [pickerViewport.longitude, pickerViewport.latitude],
                  zoomLevel: pickerViewport.zoomLevel,
                }}
              />
              {selectedCoordinate ? (
                <PointAnnotation
                  id="client-location"
                  coordinate={selectedCoordinate}
                  draggable
                  onDragEnd={handleMarkerDragEnd}
                >
                  <MapPin color={colors.primary} />
                </PointAnnotation>
              ) : null}
            </MapView>
            <Text style={styles.coordinatesLabel}>
              Mueva el pin para ajustar la ubicacion exacta del cliente.
            </Text>
            <Text style={styles.coordinatesValue}>
              Punto seleccionado: {form.latitude}, {form.longitude}
            </Text>
            <TouchableOpacity
              style={styles.clearLocationButton}
              onPress={() => {
                setForm((current) => ({ ...current, latitude: "", longitude: "" }));
                markTouched("location");
              }}
            >
              <Text style={styles.clearLocationButtonText}>Limpiar ubicacion</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mapWrapper}>
            <MapView
              style={styles.map}
              mapStyle={mapboxMapStyle}
              onPress={handleMapPress}
              scrollEnabled
              zoomEnabled
              pitchEnabled={false}
              rotateEnabled={false}
              logoEnabled={false}
              attributionEnabled={false}
            >
              <Camera
                ref={cameraRef}
                defaultSettings={{
                  centerCoordinate: [pickerViewport.longitude, pickerViewport.latitude],
                  zoomLevel: pickerViewport.zoomLevel,
                }}
              />
              {selectedCoordinate ? (
                <PointAnnotation
                  id="client-location-empty"
                  coordinate={selectedCoordinate}
                  draggable
                  onDragEnd={handleMarkerDragEnd}
                >
                  <MapPin color={colors.primary} />
                </PointAnnotation>
              ) : null}
            </MapView>
            <Text style={styles.coordinatesLabel}>
              Toque el mapa, use GPS o busque por direccion para colocar el pin del cliente.
            </Text>
          </View>
        )}
        {touched.location && fieldErrors.location ? (
          <Text style={styles.locationErrorText}>{fieldErrors.location}</Text>
        ) : hasLocation ? (
          <Text style={styles.locationHintText}>Ubicacion lista para guardar.</Text>
        ) : null}
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
  clearLocationButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  clearLocationButtonText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
  warningBox: {
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.warningMuted,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
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
  locationHintText: {
    color: colors.success,
    fontSize: 12,
    marginBottom: 12,
  },
  locationErrorText: {
    color: colors.destructive,
    fontSize: 12,
    marginBottom: 12,
  },
});
