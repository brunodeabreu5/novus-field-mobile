import type { VisitPeriod } from "../../lib/mobile-data";

export const mobileQueryKeys = {
  dashboard: (userId: string) => ["dashboard", userId] as const,
  visits: (userId: string, period: VisitPeriod) => ["visits", userId, period] as const,
  visitTypes: ["visit-types"] as const,
  visitSettings: ["visit-settings"] as const,
  clients: ["clients"] as const,
  charges: (userId: string) => ["charges", userId] as const,
  alerts: (userId: string) => ["alerts", userId] as const,
  map: ["vendor-positions"] as const,
  vendorHistory: (vendorId: string, date: string) =>
    ["vendor-history", vendorId, date] as const,
  vendors: ["vendors"] as const,
  contacts: (userId: string) => ["contacts", userId] as const,
  messages: (userId: string, otherUserId: string) =>
    ["messages", userId, otherUserId] as const,
};
