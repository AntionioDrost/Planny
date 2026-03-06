import * as Linking from 'expo-linking';
import { supabase } from '@/utils/supabase';

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function sendPasswordReset(email: string) {
  const redirectTo = Linking.createURL('/reset-password');
  return supabase.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function signInWithOAuth(provider: 'google' | 'apple') {
  const redirectTo = Linking.createURL('/');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    return { data, error };
  }

  if (data?.url) {
    await Linking.openURL(data.url);
  }

  return { data, error: null };
}

export async function signOut() {
  const globalResult = await supabase.auth.signOut();
  if (!globalResult.error) {
    return globalResult;
  }

  // Fallback for flaky network: clear local session so the user can still log out.
  const localResult = await supabase.auth.signOut({ scope: 'local' as any });
  if (!localResult.error) {
    return localResult;
  }

  return globalResult;
}
