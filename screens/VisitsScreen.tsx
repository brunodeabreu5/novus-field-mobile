import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  TextInput,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "../contexts/AuthContext";
import {
  useClientsData,
  useCreateVisit,
  useVisitTypeOptionsData,
  useVisitsData,
} from "../hooks/use-mobile-data";
import type {
  Client,
  DraftVisitAttachment,
  VisitAttachment,
  VisitPeriod,
  VisitRecord,
  VisitTypeOption,
} from "../lib/mobile-data";
import {
  deleteVisitAttachment,
  fetchVisitAttachments,
  offlineStorage,
  uploadVisitAttachments,
} from "../lib/mobile-data";
import { mobileQueryKeys } from "../hooks/data/query-keys";
import BottomSheetModal from "../components/BottomSheetModal";
import FormActions from "../components/FormActions";
import FormField from "../components/FormField";
import { colors } from "../theme/colors";
import { spacing, fontSize, radius } from "../theme/spacing";
const s = spacing; const f = fontSize; const r = radius;

const getDefaultVisitType = (types: VisitTypeOption[]) =>
  types.find((item) => item.is_default)?.name || types[0]?.name || "Comercial";

const EMPTY_VISITS: VisitRecord[] = [];

function areAttachmentListsEqual(a: VisitAttachment[], b: VisitAttachment[]) {
  if (a.length !== b.length) return false;

  return a.every((item, index) => {
    const other = b[index];
    return (
      item.id === other.id &&
      item.file_name === other.file_name &&
      item.signed_url === other.signed_url &&
      item.attachment_kind === other.attachment_kind &&
      item.is_legacy === other.is_legacy
    );
  });
}

function areAttachmentsByVisitEqual(
  current: Record<string, VisitAttachment[]>,
  next: Record<string, VisitAttachment[]>,
) {
  const compareKeys = (left: string, right: string) => left.localeCompare(right);
  const currentKeys = Object.keys(current).sort(compareKeys);
  const nextKeys = Object.keys(next).sort(compareKeys);

  if (currentKeys.length !== nextKeys.length) return false;
  if (currentKeys.some((key, index) => key !== nextKeys[index])) return false;

  return nextKeys.every((key) =>
    areAttachmentListsEqual(current[key] ?? EMPTY_VISITS, next[key] ?? EMPTY_VISITS),
  );
}

function buildDraftAttachment(input: {
  uri: string;
  fileName: string;
  mimeType?: string | null;
  size?: number | null;
  attachmentKind: "image" | "document";
}): DraftVisitAttachment {
  return {
    uri: input.uri,
    file_name: input.fileName,
    mime_type: input.mimeType ?? null,
    file_size_bytes: input.size ?? null,
    attachment_kind: input.attachmentKind,
  };
}

type VisitsStyles = Record<string, any>;

interface ClientPickerContentProps {
  readonly clients: Client[];
  readonly clientSearch: string;
  readonly onClientSearchChange: (value: string) => void;
  readonly selectedClientId: string;
  readonly onSelectClient: (client: Client) => void;
  readonly onBack: () => void;
  readonly styles: VisitsStyles;
  readonly colors: typeof colors;
}

function ClientPickerContent({
  clients,
  clientSearch,
  onClientSearchChange,
  selectedClientId,
  onSelectClient,
  onBack,
  styles,
  colors,
}: ClientPickerContentProps) {
  return (
    <>
      <TouchableOpacity style={styles.pickerBackButton} onPress={onBack}>
        <Text style={styles.pickerBackButtonText}>Volver</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar cliente..."
        placeholderTextColor={colors.mutedForeground}
        value={clientSearch}
        onChangeText={onClientSearchChange}
      />
      <View style={styles.optionList}>
        {clients.map((client) => (
          <TouchableOpacity
            key={client.id}
            style={[
              styles.typeOption,
              selectedClientId === client.id && styles.typeOptionActive,
            ]}
            onPress={() => onSelectClient(client)}
          >
            <Text
              style={[
                styles.typeOptionText,
                selectedClientId === client.id && styles.typeOptionTextActive,
              ]}
            >
              {client.name}
            </Text>
          </TouchableOpacity>
        ))}
        {clients.length === 0 ? (
          <Text style={styles.emptyTypes}>No se encontraron clientes.</Text>
        ) : null}
      </View>
    </>
  );
}

interface VisitTypePickerContentProps {
  readonly visitTypes: VisitTypeOption[];
  readonly selectedVisitType: string;
  readonly onSelectVisitType: (visitType: string) => void;
  readonly onBack: () => void;
  readonly styles: VisitsStyles;
}

function VisitTypePickerContent({
  visitTypes,
  selectedVisitType,
  onSelectVisitType,
  onBack,
  styles,
}: VisitTypePickerContentProps) {
  return (
    <>
      <TouchableOpacity style={styles.pickerBackButton} onPress={onBack}>
        <Text style={styles.pickerBackButtonText}>Volver</Text>
      </TouchableOpacity>
      <View style={styles.optionList}>
        {visitTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.typeOption,
              selectedVisitType === type.name && styles.typeOptionActive,
            ]}
            onPress={() => onSelectVisitType(type.name)}
          >
            <Text
              style={[
                styles.typeOptionText,
                selectedVisitType === type.name && styles.typeOptionTextActive,
              ]}
            >
              {type.name}
            </Text>
          </TouchableOpacity>
        ))}
        {visitTypes.length === 0 ? (
          <Text style={styles.emptyTypes}>
            No hay tipos de visita activos configurados.
          </Text>
        ) : null}
      </View>
    </>
  );
}

export default function VisitsScreen() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [activePicker, setActivePicker] = useState<"client" | "type" | null>(null);
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);
  const [period, setPeriod] = useState<VisitPeriod>("week");
  const [useManualClientEntry, setUseManualClientEntry] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedVisitForAttachment, setSelectedVisitForAttachment] = useState<VisitRecord | null>(null);
  const [attachmentsByVisit, setAttachmentsByVisit] = useState<Record<string, VisitAttachment[]>>({});
  const [loadingAttachmentsByVisit, setLoadingAttachmentsByVisit] = useState<Record<string, boolean>>({});
  const [uploadingVisitId, setUploadingVisitId] = useState<string | null>(null);
  const [pendingAttachmentCountByVisit, setPendingAttachmentCountByVisit] =
    useState<Record<string, number>>({});
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientId: "",
    clientName: "",
    notes: "",
    visitType: "Comercial",
  });
  const [draftAttachments, setDraftAttachments] = useState<DraftVisitAttachment[]>([]);

  const visitsQuery = useVisitsData(user?.id, period);
  const visits = visitsQuery.data ?? EMPTY_VISITS;
  const { isLoading, refetch: refetchVisits } = visitsQuery;
  const { data: visitTypes = [], isLoading: isLoadingVisitTypes } =
    useVisitTypeOptionsData();
  const { data: clients = [] } = useClientsData();
  const createVisitMutation = useCreateVisit();

  const visitsWithAttachments = useMemo(
    () =>
      visits.filter((visit) => (visit.attachments_count || visit.photos_count || 0) > 0),
    [visits],
  );

  const visitsWithAttachmentsKey = useMemo(
    () =>
      visitsWithAttachments
        .map((visit) => `${visit.id}:${visit.attachments_count || 0}:${visit.photos_count || 0}`)
        .join("|"),
    [visitsWithAttachments],
  );

  const filteredClients = useMemo(() => {
    const normalized = clientSearch.trim().toLowerCase();
    if (!normalized) {
      return clients;
    }

    return clients.filter((client) => client.name.toLowerCase().includes(normalized));
  }, [clientSearch, clients]);

  const openModal = () => {
    const defaultVisitType = getDefaultVisitType(visitTypes);
    setForm({
      clientId: "",
      clientName: "",
      notes: "",
      visitType: defaultVisitType,
    });
    setClientSearch("");
    setUseManualClientEntry(false);
    setDraftAttachments([]);
    setSelectedVisitForAttachment(null);
    setActivePicker(null);
    setModalVisible(true);
  };

  const handleModalRequestClose = () => {
    if (activePicker) {
      setActivePicker(null);
      return;
    }

    setModalVisible(false);
  };

  const getModalTitle = () => {
    if (activePicker === "client") {
      return "Seleccionar Cliente";
    }

    if (activePicker === "type") {
      return "Seleccionar Tipo";
    }

    return "Nueva Visita";
  };

  const renderModalContent = () => {
    if (activePicker === "client") {
      return (
        <ClientPickerContent
          clients={filteredClients}
          clientSearch={clientSearch}
          onClientSearchChange={setClientSearch}
          selectedClientId={form.clientId}
          onSelectClient={(client) => {
            setForm((current) => ({
              ...current,
              clientId: client.id,
              clientName: client.name,
            }));
            setActivePicker(null);
          }}
          onBack={() => setActivePicker(null)}
          styles={styles}
          colors={colors}
        />
      );
    }

    if (activePicker === "type") {
      return (
        <VisitTypePickerContent
          visitTypes={visitTypes}
          selectedVisitType={form.visitType}
          onSelectVisitType={(visitType) => {
            setForm((current) => ({ ...current, visitType }));
            setActivePicker(null);
          }}
          onBack={() => setActivePicker(null)}
          styles={styles}
        />
      );
    }

    return (
      <>
        <View style={styles.clientModeRow}>
          <TouchableOpacity
            style={[
              styles.clientModeChip,
              !useManualClientEntry && styles.clientModeChipActive,
            ]}
            onPress={() => setUseManualClientEntry(false)}
          >
            <Text
              style={[
                styles.clientModeText,
                !useManualClientEntry && styles.clientModeTextActive,
              ]}
            >
              Cliente existente
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.clientModeChip,
              useManualClientEntry && styles.clientModeChipActive,
            ]}
            onPress={() => {
              setUseManualClientEntry(true);
              setForm((current) => ({ ...current, clientId: "" }));
            }}
          >
            <Text
              style={[
                styles.clientModeText,
                useManualClientEntry && styles.clientModeTextActive,
              ]}
            >
              Cliente no cadastrado
            </Text>
          </TouchableOpacity>
        </View>

        {useManualClientEntry ? (
          <FormField
            label="Cliente"
            placeholder="Nombre del cliente"
            value={form.clientName}
            onChangeText={(text) =>
              setForm((current) => ({ ...current, clientName: text, clientId: "" }))
            }
          />
        ) : (
          <>
            <Text style={styles.label}>Cliente</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setActivePicker("client")}
            >
              <Text
                style={[
                  styles.selectorText,
                  !form.clientName && styles.selectorPlaceholder,
                ]}
              >
                {form.clientName || "Seleccione un cliente"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.label}>Tipo</Text>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setActivePicker("type")}
          disabled={isLoadingVisitTypes}
        >
          <Text
            style={[
              styles.selectorText,
              !form.visitType && styles.selectorPlaceholder,
            ]}
          >
            {isLoadingVisitTypes
              ? "Cargando tipos..."
              : form.visitType || "Seleccione un tipo"}
          </Text>
        </TouchableOpacity>

        <FormField
          label="Notas (opcional)"
          placeholder="Notas..."
          value={form.notes}
          onChangeText={(text) =>
            setForm((current) => ({ ...current, notes: text }))
          }
          multiline
        />

        <View style={styles.attachmentButtonsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              void handleCapturePhoto().then(appendDraftAttachments);
            }}
          >
            <Text style={styles.secondaryButtonText}>Tomar foto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              void handlePickImage().then(appendDraftAttachments);
            }}
          >
            <Text style={styles.secondaryButtonText}>Galería</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              void handlePickDocument().then(appendDraftAttachments);
            }}
          >
            <Text style={styles.secondaryButtonText}>Documento</Text>
          </TouchableOpacity>
        </View>

        {draftAttachments.length > 0 ? (
          <View style={styles.draftAttachmentsList}>
            {draftAttachments.map((attachment, index) => (
              renderDraftAttachment(attachment, index)
            ))}
          </View>
        ) : null}

        <FormActions
          isLoading={createVisitMutation.isPending}
          submitLabel="Crear Visita"
          onCancel={() => setModalVisible(false)}
          onSubmit={handleCreateVisit}
        />
      </>
    );
  };

  useEffect(() => {
    let cancelled = false;

    if (visitsWithAttachments.length === 0) {
      setAttachmentsByVisit((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }

    const load = async () => {
      const next: Record<string, VisitAttachment[]> = {};
      await Promise.all(
        visitsWithAttachments.map(async (visit) => {
          try {
            next[visit.id] = await fetchVisitAttachments(visit.id);
          } catch {
            next[visit.id] = [];
          }
        }),
      );

      if (!cancelled) {
        setAttachmentsByVisit((current) =>
          areAttachmentsByVisitEqual(current, next) ? current : next,
        );
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [visitsWithAttachments, visitsWithAttachmentsKey]);

  useEffect(() => {
    let cancelled = false;

    const loadPendingAttachmentCounts = async () => {
      const queue = await offlineStorage.getQueue();
      const counts = queue.reduce<Record<string, number>>((acc, item) => {
        if (item.type !== "visit_attachment_upload") {
          return acc;
        }

        acc[item.payload.visitId] = (acc[item.payload.visitId] || 0) + 1;
        return acc;
      }, {});

      if (!cancelled) {
        setPendingAttachmentCountByVisit(counts);
      }
    };

    void loadPendingAttachmentCounts();

    return () => {
      cancelled = true;
    };
  }, [attachmentsByVisit, visits]);

  const refreshVisitData = async () => {
    await refetchVisits();
    if (user?.id) {
      await queryClient.invalidateQueries({
        queryKey: mobileQueryKeys.visits(user.id, period),
      });
    }
  };

  const loadVisitAttachments = async (visitId: string) => {
    setLoadingAttachmentsByVisit((current) => ({ ...current, [visitId]: true }));
    try {
      const attachments = await fetchVisitAttachments(visitId);
      setAttachmentsByVisit((current) => ({ ...current, [visitId]: attachments }));
    } finally {
      setLoadingAttachmentsByVisit((current) => ({ ...current, [visitId]: false }));
    }
  };

  const appendDraftAttachments = (items: DraftVisitAttachment[]) => {
    if (items.length === 0) return;
    setDraftAttachments((current) => [...current, ...items]);
  };

  const handleCapturePhoto = async (): Promise<DraftVisitAttachment[]> => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Permiso requerido", "Permita acceso a la cámara para tomar fotos.");
      return [];
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });

    if (result.canceled) return [];

    return result.assets.map((asset) =>
      buildDraftAttachment({
        uri: asset.uri,
        fileName: asset.fileName || `foto-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        size: asset.fileSize ?? null,
        attachmentKind: "image",
      }),
    );
  };

  const handlePickImage = async (): Promise<DraftVisitAttachment[]> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Permiso requerido", "Permita acceso a la galería para adjuntar fotos.");
      return [];
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (result.canceled) return [];

    return result.assets.map((asset) =>
      buildDraftAttachment({
        uri: asset.uri,
        fileName: asset.fileName || `imagen-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        size: asset.fileSize ?? null,
        attachmentKind: "image",
      }),
    );
  };

  const handlePickDocument = async (): Promise<DraftVisitAttachment[]> => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled) return [];

    return result.assets.map((asset) =>
      buildDraftAttachment({
        uri: asset.uri,
        fileName: asset.name,
        mimeType: asset.mimeType || "application/octet-stream",
        size: asset.size ?? null,
        attachmentKind: "document",
      }),
    );
  };

  const handleUploadToExistingVisit = async (
    visit: VisitRecord,
    items: DraftVisitAttachment[],
  ) => {
    setUploadingVisitId(visit.id);
    try {
      const result = await uploadVisitAttachments(visit.id, items);
      if (result.failed.length > 0) {
        Alert.alert(
          "Carga parcial",
          `${result.uploaded.length} archivo(s) subido(s). ${result.failed.length} con error.`,
        );
      } else if (result.queued > 0) {
        setPendingAttachmentCountByVisit((current) => ({
          ...current,
          [visit.id]: (current[visit.id] || 0) + result.queued,
        }));
        Alert.alert(
          "Anexos en cola",
          `${result.queued} archivo(s) se sincronizarán cuando vuelva la conexión.`,
        );
        return;
      }
      await loadVisitAttachments(visit.id);
      await refreshVisitData();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudieron subir los anexos.",
      );
    } finally {
      setUploadingVisitId(null);
    }
  };

  const handleAttachmentAction = async (mode: "camera" | "gallery" | "document") => {
    setAttachmentMenuVisible(false);

    let pickedItems: DraftVisitAttachment[] = [];
    if (mode === "camera") {
      pickedItems = await handleCapturePhoto();
    } else if (mode === "gallery") {
      pickedItems = await handlePickImage();
    } else {
      pickedItems = await handlePickDocument();
    }

    if (pickedItems.length === 0) {
      return;
    }

    if (!selectedVisitForAttachment) {
      appendDraftAttachments(pickedItems);
      return;
    }

    await handleUploadToExistingVisit(selectedVisitForAttachment, pickedItems);
    setSelectedVisitForAttachment(null);
  };

  const handleCreateVisit = async () => {
    if (!user || !profile) {
      Alert.alert("Error", "Sesión inválida.");
      return;
    }

    const resolvedClientName = form.clientName.trim();
    if (!resolvedClientName) {
      Alert.alert("Error", "Seleccione o ingrese un cliente.");
      return;
    }

    if (!form.visitType.trim()) {
      Alert.alert("Error", "Seleccione un tipo de visita");
      return;
    }

    try {
      const result = await createVisitMutation.mutateAsync({
        userId: user.id,
        vendorName: profile.full_name || user.email || "Vendedor",
        clientId: form.clientId || null,
        clientName: resolvedClientName,
        notes: form.notes,
        visitType: form.visitType,
      });

      if (result.queued) {
        if (draftAttachments.length > 0) {
          const uploadResult = await uploadVisitAttachments(result.visit.id, draftAttachments);
          if (uploadResult.failed.length > 0) {
            Alert.alert(
              "Visita en cola con errores",
              `${uploadResult.queued} anexo(s) en cola y ${uploadResult.failed.length} con error.`,
            );
          } else {
            Alert.alert(
              "Visita en cola",
              "La visita y sus anexos quedaron en cola para sincronizarse cuando vuelva la conexión.",
            );
          }
        }
        setModalVisible(false);
        setDraftAttachments([]);
        return;
      }

      if (draftAttachments.length > 0) {
        const uploadResult = await uploadVisitAttachments(result.visit.id, draftAttachments);
        if (uploadResult.failed.length > 0) {
          Alert.alert(
            "Visita creada con anexos pendientes",
            `${uploadResult.uploaded.length} archivo(s) subido(s). ${uploadResult.failed.length} con error.`,
          );
        }
      }

      setModalVisible(false);
      setDraftAttachments([]);
      await refreshVisitData();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo crear la visita",
      );
    }
  };

  const openAttachment = async (attachment: VisitAttachment) => {
    try {
      setOpeningAttachmentId(attachment.id);
      const localUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}${attachment.id}-${attachment.file_name}`;
      const downloadResult = await FileSystem.downloadAsync(attachment.signed_url, localUri);
      await Sharing.shareAsync(downloadResult.uri);
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo abrir el archivo.",
      );
    } finally {
      setOpeningAttachmentId(null);
    }
  };

  const handleDeleteAttachment = async (visitId: string, attachmentId: string) => {
    try {
      await deleteVisitAttachment(visitId, attachmentId);
      await loadVisitAttachments(visitId);
      await refreshVisitData();
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "No se pudo eliminar el anexo.",
      );
    }
  };

  const renderAttachment = (visit: VisitRecord, attachment: VisitAttachment) => (
    <TouchableOpacity
      key={attachment.id}
      style={styles.attachmentCard}
      onPress={() => void openAttachment(attachment)}
      disabled={openingAttachmentId === attachment.id}
      onLongPress={() => {
        if (attachment.is_legacy) {
          return;
        }
        Alert.alert("Eliminar anexo", `¿Eliminar ${attachment.file_name}?`, [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: () => void handleDeleteAttachment(visit.id, attachment.id),
          },
        ]);
      }}
    >
      {attachment.attachment_kind === "image" ? (
        <Image source={{ uri: attachment.signed_url }} style={styles.attachmentImage} />
      ) : (
        <View style={styles.documentAttachment}>
          <Text style={styles.documentAttachmentIcon}>
            {openingAttachmentId === attachment.id ? "..." : "DOC"}
          </Text>
          <Text style={styles.documentAttachmentName} numberOfLines={2}>
            {attachment.file_name}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderDraftAttachment = (attachment: DraftVisitAttachment, index: number) => (
    <View key={`${attachment.file_name}-${index}`} style={styles.draftAttachmentRow}>
      <View style={styles.draftAttachmentInfo}>
        <Text style={styles.draftAttachmentName} numberOfLines={1}>
          {attachment.file_name}
        </Text>
        <Text style={styles.draftAttachmentHint}>Se sincroniza si estas offline</Text>
      </View>
      <TouchableOpacity
        onPress={() => removeDraftAttachmentAtIndex(index)}
      >
        <Text style={styles.removeDraftAttachment}>Remover</Text>
      </TouchableOpacity>
    </View>
  );

  const removeDraftAttachmentAtIndex = (index: number) => {
    setDraftAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const renderVisit = ({ item }: { item: VisitRecord }) => {
    const docsCount = Math.max(
      0,
      (item.attachments_count || 0) - (item.photos_count || 0),
    );

    return (
      <View style={styles.visitCard}>
        <View style={styles.visitHeader}>
          <Text style={styles.visitClient}>{item.client_name}</Text>
          {item.check_out_at ? (
            <View style={[styles.badge, styles.badgeDone]}>
              <Text style={[styles.badgeText, styles.badgeTextDone]}>Completada</Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.badgePending]}>
              <Text style={[styles.badgeText, styles.badgeTextPending]}>En curso</Text>
            </View>
          )}
        </View>
        <Text style={styles.visitMeta}>
          {item.visit_type} • {format(new Date(item.check_in_at), "dd MMM HH:mm", { locale: es })}
        </Text>
        {item.notes ? <Text style={styles.visitNotes}>{item.notes}</Text> : null}
        <View style={styles.visitCounts}>
          <Text style={styles.countText}>Fotos: {item.photos_count || 0}</Text>
          <Text style={styles.countText}>Docs: {docsCount}</Text>
        </View>
        {pendingAttachmentCountByVisit[item.id] ? (
          <View style={styles.pendingSyncBadge}>
            <Text style={styles.pendingSyncBadgeText}>
              {pendingAttachmentCountByVisit[item.id]} anexo(s) pendente(s) de sync
            </Text>
          </View>
        ) : null}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setSelectedVisitForAttachment(item);
              setDraftAttachments([]);
              setAttachmentMenuVisible(true);
            }}
            disabled={uploadingVisitId === item.id}
          >
            <Text style={styles.secondaryButtonText}>
              {uploadingVisitId === item.id ? "Subiendo..." : "Anexar"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => void loadVisitAttachments(item.id)}
            disabled={loadingAttachmentsByVisit[item.id]}
          >
            <Text style={styles.secondaryButtonText}>
              {loadingAttachmentsByVisit[item.id] ? "Cargando..." : "Ver anexos"}
            </Text>
          </TouchableOpacity>
        </View>
        {attachmentsByVisit[item.id]?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentsRow}>
            {attachmentsByVisit[item.id].map((attachment) => renderAttachment(item, attachment))}
          </ScrollView>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.periodBtn, period === "today" && styles.periodBtnActive]}
          onPress={() => setPeriod("today")}
        >
          <Text
            style={[
              styles.periodText,
              period === "today" && styles.periodTextActive,
            ]}
          >
            Hoy
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodBtn, period === "week" && styles.periodBtnActive]}
          onPress={() => setPeriod("week")}
        >
          <Text
            style={[
              styles.periodText,
              period === "week" && styles.periodTextActive,
            ]}
          >
            Semana
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={openModal}>
          <Text style={styles.addBtnText}>+ Nueva Visita</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => item.id}
          renderItem={renderVisit}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Sin visitas en el periodo</Text>
          }
        />
      )}

      <BottomSheetModal
        visible={modalVisible}
        title={getModalTitle()}
        onRequestClose={handleModalRequestClose}
        contentStyle={styles.modal}
      >
        {renderModalContent()}
      </BottomSheetModal>

      <BottomSheetModal
        visible={attachmentMenuVisible}
        title="Agregar Anexo"
        onRequestClose={() => {
          setAttachmentMenuVisible(false);
          setSelectedVisitForAttachment(null);
        }}
        contentStyle={styles.modal}
      >
        <TouchableOpacity style={styles.typeOption} onPress={() => void handleAttachmentAction("camera")}>
          <Text style={styles.typeOptionText}>Tomar foto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.typeOption} onPress={() => void handleAttachmentAction("gallery")}>
          <Text style={styles.typeOptionText}>Elegir foto de la galería</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.typeOption} onPress={() => void handleAttachmentAction("document")}>
          <Text style={styles.typeOptionText}>Adjuntar documento</Text>
        </TouchableOpacity>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: s.sm,
    padding: s.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  periodBtn: {
    paddingHorizontal: s.sm,
    paddingVertical: s.sm,
    borderRadius: r.sm,
  },
  periodBtnActive: { backgroundColor: colors.primary },
  periodText: { fontSize: f.base, color: colors.mutedForeground },
  periodTextActive: { color: colors.primaryForeground, fontWeight: "600" },
  addBtn: {
    marginLeft: "auto",
    paddingHorizontal: s.sm,
    paddingVertical: s.sm,
    backgroundColor: colors.primary,
    borderRadius: r.sm,
  },
  addBtnText: { color: colors.primaryForeground, fontWeight: "600", fontSize: f.base },
  loader: { marginTop: 32 },
  list: { padding: s.md, paddingBottom: 32 },
  empty: {
    textAlign: "center",
    color: colors.mutedForeground,
    marginTop: 32,
  },
  visitCard: {
    backgroundColor: colors.card,
    borderRadius: r.md,
    padding: s.md,
    marginBottom: s.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  visitHeader: { flexDirection: "row", justifyContent: "space-between", gap: s.sm },
  visitClient: { fontSize: f.md, fontWeight: "600", color: colors.foreground, flex: 1 },
  badge: { paddingHorizontal: s.sm, paddingVertical: s.xs, borderRadius: r.full },
  badgeDone: { backgroundColor: colors.successMuted },
  badgePending: { backgroundColor: colors.infoMuted },
  badgeText: { fontSize: f.sm, fontWeight: "600" },
  badgeTextDone: { color: colors.success },
  badgeTextPending: { color: colors.info },
  visitMeta: { fontSize: f.sm, color: colors.mutedForeground, marginTop: s.xs },
  visitNotes: { fontSize: f.sm, color: colors.foreground, marginTop: s.sm },
  visitCounts: { flexDirection: "row", gap: s.sm, marginTop: s.sm },
  countText: { fontSize: f.sm, color: colors.mutedForeground },
  pendingSyncBadge: {
    alignSelf: "flex-start",
    marginTop: s.sm,
    paddingHorizontal: s.sm,
    paddingVertical: s.xs,
    borderRadius: r.full,
    backgroundColor: colors.warningMuted,
  },
  pendingSyncBadgeText: {
    fontSize: f.sm,
    fontWeight: "600",
    color: colors.warning,
  },
  actionsRow: { flexDirection: "row", gap: s.sm, marginTop: s.sm },
  secondaryButton: {
    paddingHorizontal: s.sm,
    paddingVertical: s.xs,
    borderRadius: r.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  secondaryButtonText: { fontSize: f.sm, color: colors.foreground, fontWeight: "600" },
  attachmentsRow: { marginTop: s.sm },
  attachmentCard: {
    width: 92,
    height: 92,
    marginRight: s.sm,
    borderRadius: r.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  attachmentImage: { width: "100%", height: "100%" },
  documentAttachment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: s.sm,
    gap: s.sm,
  },
  documentAttachmentIcon: { fontSize: f.sm, fontWeight: "700", color: colors.primary },
  documentAttachmentName: { fontSize: f.sm, color: colors.foreground, textAlign: "center" },
  modal: {},
  label: { fontSize: f.base, fontWeight: "500", marginBottom: s.sm },
  selector: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.md,
    paddingHorizontal: s.sm,
    paddingVertical: s.sm,
    marginBottom: s.md,
    backgroundColor: colors.card,
  },
  selectorText: { fontSize: f.base, color: colors.foreground },
  selectorPlaceholder: { color: colors.mutedForeground },
  typeOption: {
    paddingHorizontal: s.sm,
    paddingVertical: s.sm,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginBottom: s.sm,
  },
  typeOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeOptionText: { fontSize: f.base, color: colors.foreground, fontWeight: "600" },
  typeOptionTextActive: { color: colors.primaryForeground },
  emptyTypes: { textAlign: "center", color: colors.mutedForeground, marginTop: s.sm },
  clientModeRow: { flexDirection: "row", gap: s.sm, marginBottom: s.md },
  clientModeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.full,
    paddingVertical: s.sm,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  clientModeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  clientModeText: { fontSize: f.sm, color: colors.foreground, fontWeight: "600" },
  clientModeTextActive: { color: colors.primaryForeground },
  attachmentButtonsRow: { flexDirection: "row", flexWrap: "wrap", gap: s.sm, marginBottom: s.sm },
  draftAttachmentsList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.md,
    padding: s.sm,
    marginBottom: s.sm,
    gap: s.sm,
  },
  draftAttachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: s.sm,
  },
  draftAttachmentInfo: {
    flex: 1,
    gap: s.xs,
  },
  draftAttachmentName: { flex: 1, fontSize: f.sm, color: colors.foreground },
  draftAttachmentHint: { fontSize: f.xs, color: colors.primary, fontWeight: "600" },
  removeDraftAttachment: { fontSize: f.sm, color: colors.destructive, fontWeight: "600" },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.md,
    paddingHorizontal: s.sm,
    paddingVertical: s.sm,
    marginBottom: s.sm,
    color: colors.foreground,
    backgroundColor: colors.card,
  },
  optionList: { maxHeight: 320 },
  pickerBackButton: {
    alignSelf: "flex-start",
    paddingHorizontal: s.xs,
    paddingVertical: s.xs,
    marginBottom: s.sm,
  },
  pickerBackButtonText: {
    color: colors.primary,
    fontSize: f.base,
    fontWeight: "600",
  },
});
