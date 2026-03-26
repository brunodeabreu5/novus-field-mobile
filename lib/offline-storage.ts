import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "novus_sync_queue";
const VISIT_MAPPING_KEY = "novus_sync_visit_mapping";

export interface QueuePosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface CheckInPayload {
  visitId: string;
  zoneId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  position: QueuePosition;
  timestamp: string;
}

export interface CheckOutPayload {
  visitId: string;
  zoneId: string;
  position: QueuePosition;
  timestamp: string;
}

export interface VisitCreatePayload {
  visitId: string;
  zoneId: string;
  clientName: string;
  vendorId: string;
  vendorName: string;
  position: QueuePosition;
  timestamp: string;
}

export interface ManualVisitCreatePayload {
  visitId: string;
  vendorId: string;
  vendorName: string;
  clientId: string | null;
  clientName: string;
  notes: string | null;
  visitType: string | null;
  timestamp: string;
}

export interface ClientCreatePayload {
  clientId: string;
  userId: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ClientUpdatePayload {
  clientId: string;
  userId: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ChargeCreatePayload {
  chargeId: string;
  userId: string;
  vendorName: string;
  clientId: string | null;
  clientName: string;
  amount: number;
  dueDate: string | null;
  notes: string | null;
}

export interface ChatSendPayload {
  messageId: string;
  senderId: string;
  receiverId: string;
  message: string;
  createdAt: string;
  attachments: QueuedChatAttachmentPayload[];
}

export interface QueuedVisitAttachmentPayload {
  attachmentId: string;
  visitId: string;
  localUri: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  attachmentKind: "image" | "document";
}

export interface QueuedChatAttachmentPayload {
  attachmentId: string;
  localUri: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  attachmentKind: string;
  durationSeconds: number | null;
}

export interface VendorPositionPayload {
  vendorId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  speedKmh: number | null;
  heading: number | null;
  isIdle: boolean;
  idleDurationSeconds: number | null;
  recordedAt: string;
}

interface QueuedActionBase {
  id: string;
  createdAt: string;
  retries: number;
}

export interface CheckInAction extends QueuedActionBase {
  type: "check_in";
  payload: CheckInPayload;
}

export interface CheckOutAction extends QueuedActionBase {
  type: "check_out";
  payload: CheckOutPayload;
}

export interface VisitCreateAction extends QueuedActionBase {
  type: "visit_create";
  payload: VisitCreatePayload;
}

export interface ManualVisitCreateAction extends QueuedActionBase {
  type: "manual_visit_create";
  payload: ManualVisitCreatePayload;
}

export interface ClientCreateAction extends QueuedActionBase {
  type: "client_create";
  payload: ClientCreatePayload;
}

export interface ClientUpdateAction extends QueuedActionBase {
  type: "client_update";
  payload: ClientUpdatePayload;
}

export interface ChargeCreateAction extends QueuedActionBase {
  type: "charge_create";
  payload: ChargeCreatePayload;
}

export interface ChatSendAction extends QueuedActionBase {
  type: "chat_send";
  payload: ChatSendPayload;
}

export interface VendorPositionAction extends QueuedActionBase {
  type: "vendor_position";
  payload: VendorPositionPayload;
}

export interface VisitAttachmentUploadAction extends QueuedActionBase {
  type: "visit_attachment_upload";
  payload: QueuedVisitAttachmentPayload;
}

export type QueuedAction =
  | CheckInAction
  | CheckOutAction
  | VisitCreateAction
  | ManualVisitCreateAction
  | ClientCreateAction
  | ClientUpdateAction
  | ChargeCreateAction
  | ChatSendAction
  | VendorPositionAction
  | VisitAttachmentUploadAction;
type NewQueuedAction = Omit<QueuedAction, "id" | "createdAt" | "retries">;

let queueCache: QueuedAction[] | null = null;
let visitMappingCache: Record<string, string> | null = null;

async function loadQueue(): Promise<QueuedAction[]> {
  if (queueCache) return queueCache;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    queueCache = raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    queueCache = [];
  }
  return queueCache;
}

async function saveQueue(items: QueuedAction[]) {
  queueCache = items;
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

async function loadVisitMapping(): Promise<Record<string, string>> {
  if (visitMappingCache) return visitMappingCache;
  try {
    const raw = await AsyncStorage.getItem(VISIT_MAPPING_KEY);
    visitMappingCache = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    visitMappingCache = {};
  }
  return visitMappingCache;
}

async function saveVisitMapping(mapping: Record<string, string>) {
  visitMappingCache = mapping;
  await AsyncStorage.setItem(VISIT_MAPPING_KEY, JSON.stringify(mapping));
}

export const offlineStorage = {
  async enqueue(action: NewQueuedAction) {
    const queue = await loadQueue();
    const item: QueuedAction = {
      ...action,
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      retries: 0,
    } as QueuedAction;
    queue.push(item);
    await saveQueue(queue);
  },

  async getQueue(): Promise<QueuedAction[]> {
    return loadQueue();
  },

  async removeFromQueue(id: string) {
    const queue = await loadQueue();
    const next = queue.filter((q) => q.id !== id);
    await saveQueue(next);
  },

  async incrementRetries(id: string) {
    const queue = await loadQueue();
    const next = queue.map((item) =>
      item.id === id ? { ...item, retries: item.retries + 1 } : item
    );
    await saveQueue(next);
  },

  async clearQueue() {
    queueCache = [];
    await AsyncStorage.removeItem(QUEUE_KEY);
  },

  async setVisitMapping(localVisitId: string, remoteVisitId: string) {
    const mapping = await loadVisitMapping();
    mapping[localVisitId] = remoteVisitId;
    await saveVisitMapping(mapping);
  },

  async getVisitMapping(localVisitId: string) {
    const mapping = await loadVisitMapping();
    return mapping[localVisitId] ?? null;
  },

  async clearVisitMappings() {
    visitMappingCache = {};
    await AsyncStorage.removeItem(VISIT_MAPPING_KEY);
  },
};
