import { supabase } from "../supabase";
import type { Tables } from "../types";

type VisitTypeOption = Tables<"visit_type_options">;

export async function fetchVisitTypeOptions(activeOnly = true): Promise<VisitTypeOption[]> {
  let query = supabase
    .from("visit_type_options")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (activeOnly) {
    query = query.eq("active", true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as VisitTypeOption[];
}

export async function fetchDefaultVisitTypeName(): Promise<string> {
  const { data, error } = await supabase
    .from("visit_type_options")
    .select("name")
    .eq("active", true)
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.name || "Comercial";
}
