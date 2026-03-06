import { Platform } from 'react-native';

const required = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const;

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
});

const parsed = process.env.EXPO_PUBLIC_FEATURE_FLAGS
  ? process.env.EXPO_PUBLIC_FEATURE_FLAGS.split(',').map((part) => part.trim().toLowerCase())
  : [];

export const runtimeConfig = {
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'dev',
  isWeb: Platform.OS === 'web',
  enabledFeatures: new Set(parsed),
};
