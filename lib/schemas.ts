import { z } from "zod";

export const profileSchema = z.object({
  fullName: z.string().max(160),
  phone: z
    .string()
    .max(40)
    .refine((val) => {
      if (!val) return true;
      return /^[\d\s+\-()]{8,20}$/.test(val);
    }, "Teléfono inválido"),
  roleTitle: z.string().max(80),
});

export const clientSchema = z.object({
  name: z.string().min(1, "Nombre es obligatorio").max(160),
  document: z.string().max(32),
  phone: z
    .string()
    .max(40)
    .refine((val) => {
      if (!val) return true;
      return /^[\d\s+\-()]{8,20}$/.test(val);
    }, "Teléfono inválido"),
  email: z
    .string()
    .max(240)
    .refine((val) => {
      if (!val) return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    }, "Email inválido"),
  address: z.string().max(240),
  notes: z.string().max(1000),
  latitude: z.string().refine((val) => {
    if (!val) return true;
    return !Number.isNaN(Number(val));
  }, "Latitud inválida"),
  longitude: z.string().refine((val) => {
    if (!val) return true;
    return !Number.isNaN(Number(val));
  }, "Longitud inválida"),
});

export const chargeSchema = z.object({
  clientId: z.string().min(1, "Cliente es obligatorio"),
  clientName: z.string().min(1, "Cliente es obligatorio"),
  amount: z
    .string()
    .min(1, "Monto es obligatorio")
    .refine((val) => {
      const num = Number(val.replace(/\D/g, ""));
      return num > 0;
    }, "Monto debe ser mayor a 0"),
  dueDate: z.string().refine((val) => {
    if (!val) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(val);
  }, "Fecha inválida (YYYY-MM-DD)"),
  notes: z.string().max(1000),
});

export const visitSchema = z.object({
  clientId: z.string(),
  clientName: z.string().min(1, "El cliente es obligatorio"),
  visitType: z.string().min(1, "El tipo de visita es obligatorio"),
  amount: z.string().optional(),
  notes: z.string().max(1000),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
export type ClientFormData = z.infer<typeof clientSchema>;
export type ChargeFormData = z.infer<typeof chargeSchema>;
export type VisitFormData = z.infer<typeof visitSchema>;
