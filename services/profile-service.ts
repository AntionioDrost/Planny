import { supabase } from '@/utils/supabase';

function isMissingColumnError(error: any) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('column') && message.includes('does not exist');
}

export async function updateMyDisplayName(displayName: string) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Not authenticated');

  await supabase.auth.updateUser({
    data: { display_name: displayName },
  });

  const { error } = await supabase
    .from('users')
    .update({ display_name: displayName })
    .eq('id', authData.user.id);

  if (error) throw error;
}

export async function requestAccountDeletion() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('users')
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq('id', authData.user.id);

  if (error && !isMissingColumnError(error)) {
    throw error;
  }

  await supabase.auth.signOut();
}
