import type { VisibilityLevel } from '@/types/domain';
import { supabase } from '@/utils/supabase';

export async function updateEventVisibility(eventId: string, viewerUserId: string, level: VisibilityLevel, canSeeParticipants = false) {
  const { error } = await supabase
    .from('event_visibility')
    .upsert({
      event_id: eventId,
      viewer_user_id: viewerUserId,
      level,
      can_see_participants: canSeeParticipants,
    }, { onConflict: 'event_id,viewer_user_id' });

  if (error) throw error;
}

export async function listEventVisibility(eventId: string) {
  const { data, error } = await supabase
    .from('event_visibility')
    .select('*')
    .eq('event_id', eventId);

  if (error) throw error;
  return data ?? [];
}
