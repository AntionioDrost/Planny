import { supabase } from '@/utils/supabase';

export async function queueGenericNotification(recipientUserId: string, kind: string, payload: Record<string, unknown> = {}) {
  const { data, error } = await supabase.rpc('send_notification', {
    p_recipient_user_id: recipientUserId,
    p_kind: kind,
    p_payload: payload,
  });

  if (error) throw error;
  return data as string;
}

export async function registerDevicePushToken(token: string, platform: 'ios' | 'android' | 'web') {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('device_push_tokens')
    .upsert({
      user_id: authData.user.id,
      token,
      platform,
    }, { onConflict: 'token' });

  if (error) throw error;
}
