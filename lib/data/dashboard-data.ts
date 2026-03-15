import { startOfDay, subDays } from "date-fns";
import { supabase } from "../supabase";
import { buildVisitsByHourChart } from "../dashboard";
import type { DashboardData, Visit } from "./types";

export async function fetchDashboardData(userId: string): Promise<DashboardData> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekAgo = startOfDay(subDays(now, 6)).toISOString();

  const [visitsRes, clientsRes, chargesRes, recentRes, weekRes] = await Promise.all([
    supabase
      .from("visits")
      .select("id, check_out_at, check_in_at", { count: "exact" })
      .eq("vendor_id", userId)
      .gte("check_in_at", today),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId),
    supabase
      .from("charges")
      .select("amount")
      .eq("vendor_id", userId)
      .eq("status", "pagado"),
    supabase
      .from("visits")
      .select("*")
      .eq("vendor_id", userId)
      .order("check_in_at", { ascending: false })
      .limit(5),
    supabase
      .from("visits")
      .select("*")
      .eq("vendor_id", userId)
      .gte("check_in_at", weekAgo)
      .order("check_in_at"),
  ]);

  const firstError = [visitsRes, clientsRes, chargesRes, recentRes, weekRes].find(
    (result) => result.error
  )?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const totalCharges = (chargesRes.data || []).reduce(
    (sum, charge) => sum + ((charge as { amount?: number }).amount || 0),
    0
  );
  const completedVisits = (visitsRes.data || []).filter(
    (visit) => (visit as { check_out_at?: string | null }).check_out_at
  ).length;

  return {
    stats: {
      visitsToday: visitsRes.count || 0,
      clientsCount: clientsRes.count || 0,
      totalCharges,
      completedVisits,
      totalVisits: visitsRes.count || 0,
    },
    recentVisits: (recentRes.data || []) as Visit[],
    visitChart: buildVisitsByHourChart(
      (visitsRes.data || []) as Pick<Visit, "check_in_at">[]
    ),
    weekVisits: (weekRes.data || []) as Visit[],
  };
}
