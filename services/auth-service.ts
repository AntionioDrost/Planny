import * as Linking from 'expo-linking';
import { clearSupabaseAuthStorage, supabase } from '@/utils/supabase';
import { normalizeSupabaseError } from '@/utils/supabase-health';

function getPasswordResetRedirectUrl() {
  return process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL?.trim() || Linking.createURL('reset-password');
}

export async function signInWithEmail(email: string, password: string) {
  const result = await supabase.auth.signInWithPassword({ email, password });
  return { ...result, error: normalizeSupabaseError(result.error) };
}

export async function signUpWithEmail(email: string, password: string) {
  const result = await supabase.auth.signUp({ email, password });
  return { ...result, error: normalizeSupabaseError(result.error) };
}

export async function sendPasswordReset(email: string) {
  const result = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: getPasswordResetRedirectUrl(),
  });
  return { ...result, error: normalizeSupabaseError(result.error) };
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
    return { data, error: normalizeSupabaseError(error) };
  }

  if (data?.url) {
    await Linking.openURL(data.url);
  }

  return { data, error: null };
}

export async function signOut() {
  let localClearError: any = null;

  try {
    const globalResult = await supabase.auth.signOut();
    localClearError = globalResult.error ?? localClearError;
  } catch (error) {
    // Remote token revocation is best-effort. Local logout must still complete.
    localClearError = error;
  }

  try {
    const localResult = await supabase.auth.signOut({ scope: 'local' as any });
    localClearError = localResult.error ?? localClearError;
  } catch (error) {
    localClearError = error;
  }

  try {
    await clearSupabaseAuthStorage();
  } catch (error) {
    localClearError = localClearError ?? error;
  }

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    return {
      error: normalizeSupabaseError(
        localClearError ?? new Error('Could not clear the local session. Please close and reopen the app.')
      ),
    };
  }

  return { error: null };
}
