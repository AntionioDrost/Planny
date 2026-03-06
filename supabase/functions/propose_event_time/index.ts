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

  const { data, error } = await supabase.rpc('propose_event_time', {
    p_event_id: body.event_id,
    p_start_at_utc: body.start_at_utc,
    p_end_at_utc: body.end_at_utc,
    p_timezone: body.timezone,
    p_note: body.note ?? null,
  });

  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  return jsonResponse({ proposal_id: data });
});
