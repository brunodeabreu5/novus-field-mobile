import type { Tables } from "../types";
import type { TrackPoint, VendorTrackingStats } from "../tracking-history";

export type Visit = Tables<"visits">;
export type Client = Tables<"clients">;
export type Charge = Tables<"charges">;
export type ChatMessageRow = Tables<"chat_messages">;
export type ChatAttachmentRow = Tables<"chat_attachments">;
export type ChatReaction = Tables<"chat_reactions">;
export type ManagerNotification = Tables<"manager_notifications">;
export type VendorPosition = Tables<"vendor_positions">;
export type VisitTypeOption = Tables<"visit_type_options">;
export type VisitAttachmentKind = "image" | "document";
export type VisitRecord = Visit & {
  photos_count?: number | null;
  attachments_count?: number | null;
  has_attachments?: boolean;
};

export interface VisitAttachment {
  id: string;
  visit_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  attachment_kind: VisitAttachmentKind;
  created_by: string;
  created_at: string;
  signed_url: string;
  is_legacy?: boolean;
  queued?: boolean;
}

export interface DraftVisitAttachment {
  uri: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  attachment_kind: VisitAttachmentKind;
}

export type ChatAttachmentKind = "image" | "audio" | "file";

export interface ChatAttachment extends ChatAttachmentRow {
  attachment_kind: ChatAttachmentKind;
  signedUrl?: string | null;
  queued?: boolean;
}

export interface ChatMessage extends ChatMessageRow {
  attachments: ChatAttachment[];
  reactions: ChatReaction[];
  queued?: boolean;
}

export interface DraftChatAttachment {
  uri: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  attachment_kind: ChatAttachmentKind;
  duration_seconds?: number | null;
}

export interface VendorProfile {
  user_id: string;
  full_name: string | null;
  role_title: string | null;
}

export interface VendorRouteHistory {
  trail: TrackPoint[];
  stats: VendorTrackingStats;
}
export type VisitPeriod = "today" | "week";
export type VisitType = Visit["visit_type"];

export interface DashboardData {
  stats: {
    visitsToday: number;
    clientsCount: number;
    totalCharges: number;
    completedVisits: number;
    totalVisits: number;
  };
  recentVisits: Visit[];
  visitChart: { hour: string; visitas: number }[];
  weekVisits: Visit[];
}

export interface Contact {
  id: string;
  full_name: string;
  role_title: string | null;
  unread: number;
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageKind?: "text" | "image" | "audio" | "file";
  isOnline?: boolean;
}
