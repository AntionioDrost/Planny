import { supabase } from '@/utils/supabase';

export async function exportUserData() {
  const { data, error } = await supabase.rpc('export_user_data');
  if (error) throw error;
  return data as {
    json_export: unknown;
    ics_export: string;
  };
}
