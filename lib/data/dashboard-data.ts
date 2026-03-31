import { startOfDay, subDays } from "date-fns";
import { asItemsArray, backendApi, type CollectionResponse } from "../backend-api";
import { buildVisitsByHourChart } from "../dashboard";
import type { Charge, Client, DashboardData, Visit } from "./types";

export async function fetchDashboardData(userId: string): Promise<DashboardData> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekAgo = startOfDay(subDays(now, 6)).toISOString();

  const [allVisits, allClients, allCharges] = await Promise.all([
    backendApi.get<CollectionResponse<Visit>>("/visits?limit=1000"),
    backendApi.get<CollectionResponse<Client>>("/clients?order=name"),
    backendApi.get<CollectionResponse<Charge>>("/charges"),
  ]);
  const safeVisits = asItemsArray(allVisits);
  const safeClients = asItemsArray(allClients);
  const safeCharges = asItemsArray(allCharges);
  const visitsToday = safeVisits.filter(
    (visit) => visit.vendor_id === userId && visit.check_in_at >= today,
  );
  const recentVisits = [...safeVisits]
    .filter((visit) => visit.vendor_id === userId)
    .sort((a, b) => new Date(b.check_in_at).getTime() - new Date(a.check_in_at).getTime())
    .slice(0, 5);
  const weekVisits = safeVisits
    .filter((visit) => visit.vendor_id === userId && visit.check_in_at >= weekAgo)
    .sort((a, b) => new Date(a.check_in_at).getTime() - new Date(b.check_in_at).getTime());
  const totalCharges = safeCharges
    .filter((charge) => charge.vendor_id === userId && charge.status === "pagado")
    .reduce((sum, charge) => sum + (charge.amount || 0), 0);
  const completedVisits = visitsToday.filter((visit) => visit.check_out_at).length;
  const clientsCount = safeClients.filter((client) => client.created_by === userId).length;

  return {
    stats: {
      visitsToday: visitsToday.length,
      clientsCount,
      totalCharges,
      completedVisits,
      totalVisits: visitsToday.length,
    },
    recentVisits,
    visitChart: buildVisitsByHourChart(visitsToday as Pick<Visit, "check_in_at">[]),
    weekVisits,
  };
}
