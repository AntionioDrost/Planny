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

  const { data, error } = await supabase.rpc('send_notification', {
    p_recipient_user_id: body.recipient_user_id,
    p_kind: body.kind,
    p_payload: body.payload ?? {},
  });

  if (error) {
    return jsonResponse({ error: error.message }, 400);
  }

  return jsonResponse({ notification_id: data });
});
