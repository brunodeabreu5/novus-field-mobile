import type { Tables } from "../types";

export type Visit = Tables<"visits">;
export type Client = Tables<"clients">;
export type Charge = Tables<"charges">;
export type ChatMessage = Tables<"chat_messages">;
export type ManagerNotification = Tables<"manager_notifications">;
export type VendorPosition = Tables<"vendor_positions">;
export interface VendorProfile {
  user_id: string;
  full_name: string | null;
  role_title: string | null;
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
}
