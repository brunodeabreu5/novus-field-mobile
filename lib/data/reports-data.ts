import { backendApi } from "../backend-api";

export interface VendorPerformance {
  vendorId: string;
  vendorName: string;
  period: string;
  totalVisits: number;
  completedVisits: number;
  totalClients: number;
  activeClients: number;
  totalCharges: number;
  paidCharges: number;
  pendingCharges: number;
  avgVisitsPerDay: number;
}

export interface ClientCoverage {
  totalClients: number;
  activeClients: number;
  inactiveClients: number;
  newClients: number;
  unvisitedClients: number;
  clients: Array<{
    id: string;
    name: string;
    lastVisit: string | null;
    daysSinceLastVisit: number | null;
    assignedVendor: string | null;
    status: "active" | "inactive" | "new" | "unvisited";
  }>;
}

export interface AIAnalysisInsight {
  type: "success" | "warning" | "info";
  title: string;
  description: string;
}

export interface AIAnalysis {
  summary: string;
  insights: AIAnalysisInsight[];
  recommendations: string[];
}

interface VendorPerformanceResponse {
  profile: {
    id: string;
    full_name: string | null;
    email: string;
  };
  visits: Array<{ check_in_at: string; check_out_at: string | null }>;
  charges: Array<{ status: string }>;
  clients: Array<{ id: string }>;
}

interface ClientCoverageResponse {
  clients: Array<{
    id: string;
    name: string;
    status: "active" | "inactive" | "new" | "unvisited";
    lastVisitDate: string | null;
    daysSinceLastVisit: number | null;
    assigned_vendor_id: string | null;
  }>;
  vendors: Array<{
    id: string;
    name: string;
  }>;
}

interface AIAnalysisResponse {
  analysis: string;
  data: {
    topClientesSinVisita: string[];
    totalPendiente: number;
    totalPagado: number;
    cobertura?: number;
  };
}

function buildInsights(data: AIAnalysisResponse["data"]): AIAnalysisInsight[] {
  const insights: AIAnalysisInsight[] = [];

  if (data.totalPendiente > data.totalPagado) {
    insights.push({
      type: "warning",
      title: "Cobros pendientes altos",
      description: "La cartera pendiente supera lo cobrado en el periodo analizado.",
    });
  } else {
    insights.push({
      type: "success",
      title: "Cobranza saludable",
      description: "Lo cobrado en el periodo supera o iguala la cartera pendiente.",
    });
  }

  if (data.topClientesSinVisita.length > 0) {
    insights.push({
      type: "info",
      title: "Clientes sin visita",
      description: `Priorizar seguimiento de: ${data.topClientesSinVisita.slice(0, 3).join(", ")}.`,
    });
  }

  return insights;
}

function buildRecommendations(analysis: string): string[] {
  return analysis
    .split("\n")
    .filter((line) => /^\d+\./.test(line.trim()))
    .map((line) => line.replace(/^\d+\.\s*/, "").trim());
}

export const reportsData = {
  async getVendorPerformance(
    vendorId: string,
    period: "7d" | "30d" | "month" | "90d" | "all" = "30d"
  ): Promise<VendorPerformance> {
    const data = await backendApi.get<VendorPerformanceResponse>(
      `/reports/vendors/${vendorId}/performance?period=${period}`
    );

    const completedVisits = data.visits.filter((visit) => visit.check_out_at).length;
    const paidCharges = data.charges.filter((charge) => charge.status === "pagado").length;
    const pendingCharges = data.charges.filter(
      (charge) => charge.status === "pendiente" || charge.status === "pending"
    ).length;
    const daysDivisor =
      period === "7d" ? 7 : period === "90d" ? 90 : period === "month" ? 30 : period === "all" ? Math.max(data.visits.length, 1) : 30;

    return {
      vendorId: data.profile.id,
      vendorName: data.profile.full_name || data.profile.email,
      period,
      totalVisits: data.visits.length,
      completedVisits,
      totalClients: data.clients.length,
      activeClients: data.clients.length,
      totalCharges: data.charges.length,
      paidCharges,
      pendingCharges,
      avgVisitsPerDay: Number((data.visits.length / Math.max(daysDivisor, 1)).toFixed(1)),
    };
  },

  async getClientCoverage(
    inactiveDays?: number,
    vendorId?: string
  ): Promise<ClientCoverage> {
    const params = new URLSearchParams();
    if (inactiveDays) params.append("inactiveDays", inactiveDays.toString());
    if (vendorId) params.append("vendorId", vendorId);
    const query = params.toString();
    const data = await backendApi.get<ClientCoverageResponse>(
      `/reports/client-coverage${query ? "?" + query : ""}`
    );

    return {
      totalClients: data.clients.length,
      activeClients: data.clients.filter((client) => client.status === "active").length,
      inactiveClients: data.clients.filter((client) => client.status === "inactive").length,
      newClients: data.clients.filter((client) => client.status === "new").length,
      unvisitedClients: data.clients.filter((client) => client.status === "unvisited").length,
      clients: data.clients.map((client) => ({
        id: client.id,
        name: client.name,
        lastVisit: client.lastVisitDate,
        daysSinceLastVisit: client.daysSinceLastVisit,
        assignedVendor:
          data.vendors.find((vendor) => vendor.id === client.assigned_vendor_id)?.name || null,
        status: client.status,
      })),
    };
  },

  async getAIAnalysis(): Promise<AIAnalysis> {
    const data = await backendApi.get<AIAnalysisResponse>("/reports/ai-analysis");
    const lines = data.analysis
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      summary: lines.find((line) => line.startsWith("- Visitas registradas")) || data.analysis,
      insights: buildInsights(data.data),
      recommendations: buildRecommendations(data.analysis),
    };
  },
};
