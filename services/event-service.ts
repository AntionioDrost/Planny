import type { SyncableCalendarEvent, VisibilityLevel } from '@/types/domain';
import { supabase } from '@/utils/supabase';

export interface CreateEventBundleInput {
  title: string;
  startAtUtc: string;
  endAtUtc: string;
  timezone: string;
  isAllDay: boolean;
  location?: string | null;
  notes?: string | null;
  participantIds: string[];
  visibility: Array<{
    viewer_user_id: string;
    level: VisibilityLevel;
    can_see_participants: boolean;
  }>;
  recurrenceKind?: 'none' | 'weekly';
  recurrenceIntervalWeeks?: number;
  recurrenceUntil?: string | null;
}

export async function createEventBundle(input: CreateEventBundleInput) {
  const { data, error } = await supabase.rpc('create_event_bundle', {
    p_title: input.title,
    p_start_at_utc: input.startAtUtc,
    p_end_at_utc: input.endAtUtc,
    p_timezone: input.timezone,
    p_is_all_day: input.isAllDay,
    p_location: input.location ?? null,
    p_notes: input.notes ?? null,
    p_participant_ids: input.participantIds,
    p_visibility: input.visibility,
    p_recurrence_kind: input.recurrenceKind ?? 'none',
    p_recurrence_interval_weeks: input.recurrenceIntervalWeeks ?? 1,
    p_recurrence_until: input.recurrenceUntil ?? null,
  });

  if (error) throw error;
  return data as string;
}

export async function proposeEventTime(eventId: string, startAtUtc: string, endAtUtc: string, timezone: string, note?: string) {
  const { data, error } = await supabase.rpc('propose_event_time', {
    p_event_id: eventId,
    p_start_at_utc: startAtUtc,
    p_end_at_utc: endAtUtc,
    p_timezone: timezone,
    p_note: note ?? null,
  });

  if (error) throw error;
  return data;
}

export async function rescheduleEventAsCreator(eventId: string, startAtUtc: string, endAtUtc: string, timezone: string) {
  const { data, error } = await supabase.rpc('reschedule_event', {
    p_event_id: eventId,
    p_start_at_utc: startAtUtc,
    p_end_at_utc: endAtUtc,
    p_timezone: timezone,
  });

  if (error) throw error;
  return data as string;
}

export async function respondEventProposal(proposalId: string, action: 'accepted' | 'rejected') {
  const { data, error } = await supabase.rpc('respond_event_proposal', {
    p_proposal_id: proposalId,
    p_action: action,
  });

  if (error) throw error;
  return data;
}

export async function listMyProposals() {
  const { data, error } = await supabase
    .from('event_proposals')
    .select('id, event_id, proposer_id, start_at_utc, end_at_utc, timezone, note, status, created_at, updated_at, events(title, creator_id)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getProposal(proposalId: string) {
  const { data, error } = await supabase
    .from('event_proposals')
    .select('id, event_id, proposer_id, start_at_utc, end_at_utc, timezone, note, status, created_at, updated_at, events(*)')
    .eq('id', proposalId)
    .single();

  if (error) throw error;
  return data;
}

export async function getEventForSync(eventId: string) {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, location, notes, status, is_all_day, start_at_utc, end_at_utc, timezone')
    .eq('id', eventId)
    .single();

  if (error) throw error;
  return data as SyncableCalendarEvent;
}

export async function cancelEvent(eventId: string) {
  const { data, error } = await supabase
    .from('events')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .select('id, title, location, notes, status, is_all_day, start_at_utc, end_at_utc, timezone')
    .single();

  if (error) throw error;
  return data as SyncableCalendarEvent;
}

export async function listOwnedEventsForSync() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return [];

  const { data, error } = await supabase
    .from('events')
    .select('id, title, location, notes, status, is_all_day, start_at_utc, end_at_utc, timezone')
    .eq('creator_id', authData.user.id)
    .neq('status', 'canceled')
    .order('start_at_utc', { ascending: true });

  if (error) throw error;
  return (data ?? []) as SyncableCalendarEvent[];
}
