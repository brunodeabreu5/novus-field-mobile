import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Database } from "./types";
import { resolveSupabaseConfig } from "./config";

const { url: SUPABASE_URL, publishableKey: SUPABASE_ANON_KEY } = resolveSupabaseConfig();

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
