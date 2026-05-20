const envSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const envSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export type SupabaseReachability =
  | { ok: true; message: null }
  | { ok: false; message: string };

function isNetworkFailure(error: unknown) {
  const message = String((error as any)?.message ?? error ?? '').toLowerCase();
  const cause = String((error as any)?.cause?.message ?? '').toLowerCase();

  return (
    message.includes('fetch failed') ||
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('enotfound') ||
    cause.includes('enotfound')
  );
}

export function normalizeSupabaseError(error: any) {
  if (!error) return error;

  if (isNetworkFailure(error)) {
    return {
      ...error,
      message:
        'Supabase is unreachable. The configured project may be paused/inactive, or your network cannot reach it.',
    };
  }

  return error;
}

export async function checkSupabaseReachability(): Promise<SupabaseReachability> {
  if (!envSupabaseUrl || !envSupabaseAnonKey) {
    return {
      ok: false,
      message: 'Backend not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    };
  }

  try {
    const response = await fetch(`${envSupabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: envSupabaseAnonKey,
        Authorization: `Bearer ${envSupabaseAnonKey}`,
      },
    });

    if (response.status === 401 || response.status === 404 || response.ok) {
      return { ok: true, message: null };
    }

    return {
      ok: false,
      message: `Supabase responded with HTTP ${response.status}. Check the project URL and anon key.`,
    };
  } catch (error) {
    return {
      ok: false,
      message: normalizeSupabaseError(error).message,
    };
  }
}
