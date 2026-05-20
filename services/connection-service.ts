import { supabase } from '@/utils/supabase';
import type {
  ConnectionHandshake,
  ConnectionWithOtherUser,
  HandshakeConfirmResult,
  HandshakeScanResult,
  QrPayload,
  UserSummary,
} from '@/types/domain';

function createSetupError(message: string) {
  const error = new Error(message);
  error.name = 'SupabaseSetupError';
  return error;
}

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

function isMissingHandshakeTableError(error: any) {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    error?.code === 'PGRST204' ||
    (message.includes('connection_handshakes') && message.includes('schema cache')) ||
    (message.includes('relation') && message.includes('connection_handshakes') && message.includes('does not exist'))
  );
}

export async function issueQrPayload(): Promise<QrPayload> {
  const { data, error } = await supabase.rpc('issue_qr_payload');
  if (error) {
    if (isMissingRpcError(error)) {
      throw createSetupError(
        'QR connection RPCs are missing. Apply the Supabase handshake migrations before using connections.'
      );
    }
    throw error;
  }
  return {
    userId: data.user_id,
    token: data.token,
    expiresAt: data.expires_at,
  };
}

export async function registerQrScan(payload: QrPayload): Promise<HandshakeScanResult> {
  const { data, error } = await supabase.rpc('register_qr_scan', {
    p_scanned_user_id: payload.userId,
    p_scanned_token: payload.token,
    p_scanned_expires_at: payload.expiresAt,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      throw createSetupError(
        'QR connection RPCs are missing. Run the Supabase migrations before scanning connection codes.'
      );
    }
    throw error;
  }

  return data as HandshakeScanResult;
}

export async function confirmHandshake(handshakeId: string): Promise<HandshakeConfirmResult> {
  const { data, error } = await supabase.rpc('confirm_handshake', {
    p_handshake_id: handshakeId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      throw createSetupError(
        'Handshake confirmation RPC is missing. Run the latest Supabase migrations before confirming connections.'
      );
    }
    throw error;
  }
  return data as HandshakeConfirmResult;
}

export async function getHandshake(handshakeId: string): Promise<ConnectionHandshake> {
  const { data, error } = await supabase
    .from('connection_handshakes')
    .select('*')
    .eq('id', handshakeId)
    .single();

  if (error) {
    if (isMissingHandshakeTableError(error)) {
      throw createSetupError(
        "Supabase table 'public.connection_handshakes' is missing. Run the latest database migrations first."
      );
    }
    throw error;
  }
  return data;
}

export async function listConnections(): Promise<ConnectionWithOtherUser[]> {
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
      throw createSetupError(
        "Supabase table 'public.connections' is missing. Run the latest database migrations first."
      );
    }
    throw error;
  }

  const rows = data ?? [];
  return Promise.all(
    rows.map(async (row: any): Promise<ConnectionWithOtherUser> => {
      const otherUserId = row.user_1_id === user.id ? row.user_2_id : row.user_1_id;
      const { data: profile } = await supabase
        .from('users')
        .select('id, display_name, email, avatar_url')
        .eq('id', otherUserId)
        .single();
      return {
        ...row,
        otherUser: profile,
      };
    })
  );
}

export async function getUsersByIds(userIds: string[]): Promise<UserSummary[]> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, email, avatar_url')
    .in('id', uniqueIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as UserSummary[];
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
