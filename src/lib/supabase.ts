import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — check the EAS environment variables for this build profile.',
  );
}

// Native always uses AsyncStorage unconditionally -- there's no SSR concept
// there, so this branch never changes native behavior. Web-only wrinkle:
// AsyncStorage's web implementation reads window.localStorage, but Expo
// Router's web target does a server-side render pass in Node first (no
// `window`), which crashes if storage is touched during that pass -- so on
// web specifically, storage is only wired up once `window` actually exists
// (i.e. the real browser render, not the SSR one).
const authStorage = Platform.OS === 'web' ? (typeof window !== 'undefined' ? AsyncStorage : undefined) : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
