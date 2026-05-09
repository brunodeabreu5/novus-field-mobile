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
import { showError, showSuccess, logError } from "../lib/error-handler";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { clientSchema, type ClientFormData } from "../lib/schemas";
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
const normalizeDocument = (value: string) =>
  value.replace(/\s+/g, " ").trim().toUpperCase();
const normalizePhone = (value: string) =>
  value
    .replace(/[^\d\s+\-()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
  const { locationPermission, requestLocationPermission } =
    useDevicePermissions();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [addressSearching, setAddressSearching] = useState(false);
  const [pickerViewport, setPickerViewport] =
    useState<PickerViewport>(DEFAULT_VIEWPORT);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: emptyForm,
  });

  const formLatitude = watch("latitude");
  const formLongitude = watch("longitude");
  const formAddress = watch("address");

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
          (client.address || "").toLowerCase().includes(search.toLowerCase()),
      ),
    [clients, search],
  );

  const openModal = () => {
    setEditingClient(null);
    reset(emptyForm);
    setPickerViewport(DEFAULT_VIEWPORT);
    setModalVisible(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    reset(buildClientForm(client));
    setPickerViewport(buildViewportFromClient(client));
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingClient(null);
    reset(emptyForm);
    setPickerViewport(DEFAULT_VIEWPORT);
  };

  const hasLocation = !!(formLatitude && formLongitude);

  const updateLocation = (
    latitude: number,
    longitude: number,
    nextAddress?: string,
  ) => {
    if (nextAddress) {
      setValue("address", nextAddress);
    }
    setValue("latitude", latitude.toFixed(6));
    setValue("longitude", longitude.toFixed(6));
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

    const lat = watch("latitude");
    const lng = watch("longitude");

    if (lat.trim() && lng.trim()) {
      const latitude = Number.parseFloat(lat);
      const longitude = Number.parseFloat(lng);
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
          "Debe permitir acceso a la ubicacion para capturar el punto del cliente.",
        );
        return;
      }

      const position = await resolveCurrentLocation();

      if (!position) {
        Alert.alert(
          "GPS no disponible",
          "No se pudo obtener una ubicacion ahora. Puede mover el pin manualmente.",
        );
        return;
      }

      updateLocation(position.coords.latitude, position.coords.longitude);
    } catch (error) {
      Alert.alert(
        "Error GPS",
        error instanceof Error
          ? error.message
          : "No se pudo obtener la ubicacion actual",
      );
    } finally {
      setGpsLoading(false);
    }
  };

  const handleAddressSearch = async () => {
    const normalizedAddress = normalizeAddress(formAddress);

    if (!normalizedAddress || normalizedAddress.length < 3) {
      Alert.alert(
        "Direccion requerida",
        "Ingrese una direccion mas completa para buscar coordenadas.",
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
          "No fue posible encontrar coordenadas para esta direccion.",
        );
        return;
      }

      Alert.alert(
        "Error buscando direccion",
        error instanceof Error
          ? error.message
          : "No se pudo buscar la direccion",
      );
    } finally {
      setAddressSearching(false);
    }
  };

  const handleSaveClient = handleSubmit(async (data) => {
    if (!user) {
      Alert.alert("Error", "Usuario no autenticado");
      return;
    }

    const normalizedName = normalizeName(data.name);
    const normalizedDocument = normalizeDocument(data.document);
    const normalizedPhone = normalizePhone(data.phone);
    const normalizedEmail = normalizeEmail(data.email);
    const normalizedAddress = normalizeAddress(data.address);
    const normalizedNotes = data.notes.trim();

    const latitude = data.latitude.trim()
      ? Number.parseFloat(data.latitude.trim())
      : null;
    const longitude = data.longitude.trim()
      ? Number.parseFloat(data.longitude.trim())
      : null;

    if ((latitude === null) !== (longitude === null)) {
      Alert.alert(
        "Ubicacion incompleta",
        "Latitude y longitude deben estar completas o vacias.",
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
      logError("ClientsScreen/save", error);
      showError(error, "Error al guardar cliente");
    }
  });

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
    formLatitude.trim() && formLongitude.trim()
      ? ([
          Number.parseFloat(formLongitude),
          Number.parseFloat(formLatitude),
        ] as [number, number])
      : null;

  const renderClient = ({ item }: { item: Client }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.name}</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => openEditModal(item)}
        >
          <Text style={styles.editBtnText}>Editar</Text>
        </TouchableOpacity>
      </View>
      {item.phone ? <Text style={styles.meta}>Tel: {item.phone}</Text> : null}
      {item.document ? (
        <Text style={styles.meta}>RUC/DOC: {item.document}</Text>
      ) : null}
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
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormField
              label="Nombre *"
              placeholder="Nombre del cliente"
              value={value}
              onChangeText={onChange}
              onBlur={() => {
                onBlur();
                onChange(normalizeName(value));
              }}
              error={errors.name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="document"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormField
              label="RUC / DOC"
              placeholder="Ingrese RUC o documento"
              value={value}
              onChangeText={onChange}
              onBlur={() => {
                onBlur();
                onChange(normalizeDocument(value));
              }}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormField
              label="Telefono"
              placeholder="Telefono"
              value={value}
              onChangeText={onChange}
              keyboardType="phone-pad"
              onBlur={() => {
                onBlur();
                onChange(normalizePhone(value));
              }}
              error={errors.phone?.message}
              helpText="Puede dejarlo vacio si no lo tiene."
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormField
              label="Email"
              placeholder="Email"
              value={value}
              onChangeText={onChange}
              keyboardType="email-address"
              autoCapitalize="none"
              onBlur={() => {
                onBlur();
                onChange(normalizeEmail(value));
              }}
              error={errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="address"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormField
              label="Direccion"
              placeholder="Direccion"
              value={value}
              onChangeText={onChange}
              onBlur={() => {
                onBlur();
                onChange(normalizeAddress(value));
              }}
              error={errors.address?.message}
              helpText={
                !hasLocation
                  ? "Use GPS, el mapa o la busqueda por direccion para fijar la ubicacion."
                  : null
              }
            />
          )}
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
            <Text style={styles.warningTitle}>
              Revisar configuracion del mapa
            </Text>
            <Text style={styles.warningText}>{mapWarnings[0]}</Text>
          </View>
        ) : null}

        {formLatitude && formLongitude ? (
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
                  centerCoordinate: [
                    pickerViewport.longitude,
                    pickerViewport.latitude,
                  ],
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
              Punto seleccionado: {formLatitude}, {formLongitude}
            </Text>
            <TouchableOpacity
              style={styles.clearLocationButton}
              onPress={() => {
                setValue("latitude", "");
                setValue("longitude", "");
              }}
            >
              <Text style={styles.clearLocationButtonText}>
                Limpiar ubicacion
              </Text>
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
                  centerCoordinate: [
                    pickerViewport.longitude,
                    pickerViewport.latitude,
                  ],
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
              Toque el mapa, use GPS o busque por direccion para colocar el pin
              del cliente.
            </Text>
          </View>
        )}
        {errors.latitude || errors.longitude ? (
          <Text style={styles.locationErrorText}>
            {errors.latitude?.message || errors.longitude?.message}
          </Text>
        ) : hasLocation ? (
          <Text style={styles.locationHintText}>
            Ubicacion lista para guardar.
          </Text>
        ) : null}
        <Controller
          control={control}
          name="notes"
          render={({ field: { onChange, value } }) => (
            <FormField
              label="Notas"
              placeholder="Observaciones del cliente"
              value={value}
              onChangeText={onChange}
              multiline
            />
          )}
        />

        <FormActions
          isLoading={
            createClientMutation.isPending || updateClientMutation.isPending
          }
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
