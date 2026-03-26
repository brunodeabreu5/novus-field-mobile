export const NOTIFICATION_TEXTS = {
  tracking: {
    foregroundService: {
      title: "Novus Field tracking ativo",
      body: "Registrando localizacao do vendedor em campo.",
    },
  },
} as const;

export type NotificationTexts = typeof NOTIFICATION_TEXTS;
