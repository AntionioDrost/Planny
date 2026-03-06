import { supabase } from '@/utils/supabase';
import type { QrPayload } from '@/types/domain';

function isMissingRpcError(error: any) {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    error?.code === 'PGRST202' ||
    message.includes('could not find the function') ||
    message.includes('issue_qr_payload') ||
    message.includes('register_qr_scan') ||
    message.includes('confirm_handshake')
  );
}

function isMissingConnectionsTableError(error: any) {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    error?.code === 'PGRST204' ||
    (message.includes('public.connections') && message.includes('schema cache')) ||
    (message.includes('table') && message.includes('connections') && message.includes('schema cache'))
  );
}

export async function issueQrPayload(): Promise<QrPayload> {
  const { data, error } = await supabase.rpc('issue_qr_payload');
  if (error) {
    if (isMissingRpcError(error)) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw authError ?? new Error('Not authenticated');
      }
      return {
        userId: authData.user.id,
        token: Math.random().toString(36).slice(2, 12),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
    }
    throw error;
  }
  return {
    userId: data.user_id,
    token: data.token,
    expiresAt: data.expires_at,
  };
}

export async function registerQrScan(payload: QrPayload) {
  const { data, error } = await supabase.rpc('register_qr_scan', {
    p_scanned_user_id: payload.userId,
    p_scanned_token: payload.token,
    p_scanned_expires_at: payload.expiresAt,
  });

  if (error) {
    if (!isMissingRpcError(error)) throw error;

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      throw authError ?? new Error('Not authenticated');
    }

    const currentUserId = authData.user.id;
    if (currentUserId === payload.userId) {
      throw new Error('You cannot scan your own QR code.');
    }

    const user1 = currentUserId < payload.userId ? currentUserId : payload.userId;
    const user2 = currentUserId > payload.userId ? currentUserId : payload.userId;

    const { error: insertError } = await supabase
      .from('connections')
      .insert({
        user_1_id: user1,
        user_2_id: user2,
        status: 'active',
      });

    if (insertError && isMissingConnectionsTableError(insertError)) {
      throw new Error(
        "Supabase table 'public.connections' is missing. Run your database migrations first."
      );
    }

    if (insertError && insertError.code !== '23505') {
      throw insertError;
    }

    return {
      handshake_id: 'legacy',
      status: 'connected',
      scan_1_at: null,
      scan_2_at: null,
      confirm_1_at: null,
      confirm_2_at: null,
    } as {
      handshake_id: string;
      status: string;
      scan_1_at: string | null;
      scan_2_at: string | null;
      confirm_1_at: string | null;
      confirm_2_at: string | null;
    };
  }

  return data as {
    handshake_id: string;
    status: string;
    scan_1_at: string | null;
    scan_2_at: string | null;
    confirm_1_at: string | null;
    confirm_2_at: string | null;
  };
}

export async function confirmHandshake(handshakeId: string) {
  const { data, error } = await supabase.rpc('confirm_handshake', {
    p_handshake_id: handshakeId,
  });

  if (error) throw error;
  return data as {
    handshake_id: string;
    status: string;
    connection_id: string | null;
  };
}

export async function getHandshake(handshakeId: string) {
  const { data, error } = await supabase
    .from('connection_handshakes')
    .select('*')
    .eq('id', handshakeId)
    .single();

  if (error) throw error;
  return data;
}

export async function listConnections() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;

  const user = authData.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from('connections')
    .select('id, status, user_1_id, user_2_id, created_at, updated_at')
    .or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`)
    .neq('status', 'removed');

  if (error) {
    if (isMissingConnectionsTableError(error)) {
      return [];
    }
    throw error;
  }

  const rows = data ?? [];
  return Promise.all(
    rows.map(async (row: any) => {
      const otherUserId = row.user_1_id === user.id ? row.user_2_id : row.user_1_id;
      const { data: profile } = await supabase
        .from('users')
        .select('id, display_name, email')
        .eq('id', otherUserId)
        .single();
      return {
        ...row,
        otherUser: profile,
      };
    })
  );
}

export async function setConnectionStatus(connectionId: string, status: 'limited' | 'removed' | 'active') {
  const { error } = await supabase
    .from('connections')
    .update({ status })
    .eq('id', connectionId);

  if (error) {
    if (isMissingConnectionsTableError(error)) {
      throw new Error("Cannot update connection status because 'public.connections' is missing.");
    }
    throw error;
  }
}
