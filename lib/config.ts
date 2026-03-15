type SupabaseEnv = {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  EXPO_PUBLIC_PROJECT_ID?: string;
  [key: string]: unknown;
};

export function resolveSupabaseConfig() {
  const env = process.env as SupabaseEnv;
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url) {
    throw new Error("Missing required environment variable: EXPO_PUBLIC_SUPABASE_URL");
  }

  if (!publishableKey) {
    throw new Error("Missing required environment variable: EXPO_PUBLIC_SUPABASE_ANON_KEY");
  }

  return { url, publishableKey };
}

export function getExpoProjectId(): string | undefined {
  const env = process.env as SupabaseEnv;
  return env.EXPO_PUBLIC_PROJECT_ID?.trim();
}
