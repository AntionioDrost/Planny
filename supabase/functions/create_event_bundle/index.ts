import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createAuthedClient } from '../_shared/client.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const body = await req.json();
  const supabase = createAuthedClient(req);

  const { data, error } = await supabase.rpc('create_event_bundle', {
    p_title: body.title,
    p_start_at_utc: body.start_at_utc,
    p_end_at_utc: body.end_at_utc,
    p_timezone: body.timezone,
    p_is_all_day: body.is_all_day ?? false,
    p_location: body.location ?? null,
    p_notes: body.notes ?? null,
    p_participant_ids: body.participant_ids ?? [],
    p_visibility: body.visibility ?? [],
    p_recurrence_kind: body.recurrence_kind ?? 'none',
    p_recurrence_interval_weeks: body.recurrence_interval_weeks ?? 1,
    p_recurrence_until: body.recurrence_until ?? null,
  });

  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  return jsonResponse({ event_id: data });
});
