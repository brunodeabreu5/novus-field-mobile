export function buildVisitsByHourChart(
  visits: Array<{ check_in_at: string }>
): { hour: string; visitas: number }[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const label = `${hour.toString().padStart(2, "0")}:00`;
    const visitas = visits.filter(
      (visit) => new Date(visit.check_in_at).getHours() === hour
    ).length;
    return { hour: label, visitas };
  });
}
