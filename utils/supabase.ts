import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const envSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const envSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
const showConfigWarnings = process.env.EXPO_PUBLIC_SHOW_CONFIG_WARNINGS === '1';
const SUPABASE_CONFIG_ERROR_MESSAGE =
  'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';
const secretKeyDetected = Boolean(envSupabaseAnonKey?.startsWith('sb_secret_'));

export const isSupabaseConfigured = Boolean(envSupabaseUrl && envSupabaseAnonKey && !secretKeyDetected);

if (secretKeyDetected) {
  console.warn(
    'Detected a Supabase secret key in EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Do not use sb_secret keys in client apps. Use the anon publishable key instead.'
  );
} else if (!isSupabaseConfigured && showConfigWarnings) {
  console.warn(
    'Missing Supabase env vars: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'App routes will still load, and backend calls will return a config error until env vars are set.'
  );
}

const supabaseUrl = envSupabaseUrl ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = envSupabaseAnonKey ?? 'placeholder-anon-key';

const ExpoTokenStorage = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, value);
      return;
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(key);
      return;
    }
    return AsyncStorage.removeItem(key);
  },
};

const supabaseConfigError = {
  name: 'SupabaseConfigError',
  message: SUPABASE_CONFIG_ERROR_MESSAGE,
};

function createQueryBuilderMock() {
  const builder: any = {};
  const chainMethods = [
    'select',
    'eq',
    'neq',
    'or',
    'insert',
    'update',
    'delete',
    'upsert',
    'order',
    'lt',
    'gt',
    'in',
    'contains',
    'match',
    'not',
    'limit',
    'range',
  ];

  chainMethods.forEach((method) => {
    builder[method] = () => builder;
  });

  builder.single = async () => ({ data: null, error: supabaseConfigError });
  builder.maybeSingle = async () => ({ data: null, error: null });

  return builder;
}

function createMockSupabaseClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
      signInWithPassword: async () => ({ data: null, error: supabaseConfigError }),
      signUp: async () => ({ data: null, error: supabaseConfigError }),
      signInWithOAuth: async () => ({ data: null, error: supabaseConfigError }),
      resetPasswordForEmail: async () => ({ data: null, error: supabaseConfigError }),
      updateUser: async () => ({ data: null, error: supabaseConfigError }),
      signOut: async () => ({ error: null }),
    },
    from: () => createQueryBuilderMock(),
    rpc: async () => ({ data: null, error: supabaseConfigError }),
  };
}

export const supabase: any = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: ExpoTokenStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : createMockSupabaseClient();
