import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createAdminClient } from '../_shared/client.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

type NotificationRow = {
  id: string;
  recipient_user_id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  attempt_count: number;
};

function buildNotificationContent(kind: string) {
  switch (kind) {
    case 'event_invite':
      return {
        title: 'New plan request',
        body: 'You have a new invite waiting in Planny.',
      };
    case 'event_response':
      return {
        title: 'Plan response received',
        body: 'Someone responded to your Planny event.',
      };
    case 'proposal_created':
      return {
        title: 'Counter-proposal received',
        body: 'A participant suggested a new time in Planny.',
      };
    case 'proposal_decided':
      return {
        title: 'Proposal updated',
        body: 'Your proposed time was reviewed in Planny.',
      };
    case 'connection_confirmed':
      return {
        title: 'Connection confirmed',
        body: 'Your Planny connection is now active.',
      };
    default:
      return {
        title: 'Planny update',
        body: 'There is a new update waiting in Planny.',
      };
  }
}

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const body = await req.json().catch(() => ({}));
  const limit = Number.isFinite(body?.limit) ? Math.max(1, Math.min(Number(body.limit), 100)) : 50;
  const supabase = createAdminClient();

  const { data: notifications, error: notificationsError } = await supabase
    .from('notification_outbox')
    .select('id, recipient_user_id, kind, payload, attempt_count')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (notificationsError) {
    return jsonResponse({ error: notificationsError.message }, 400);
  }

  const rows = (notifications ?? []) as NotificationRow[];
  if (!rows.length) {
    return jsonResponse({ processed: 0, sent: 0, failed: 0 });
  }

  const recipientIds = [...new Set(rows.map((row) => row.recipient_user_id))];
  const { data: tokens, error: tokensError } = await supabase
    .from('device_push_tokens')
    .select('user_id, token, platform')
    .in('user_id', recipientIds);

  if (tokensError) {
    return jsonResponse({ error: tokensError.message }, 400);
  }

  const tokensByUser = new Map<string, string[]>();
  for (const tokenRow of tokens ?? []) {
    const token = String(tokenRow.token ?? '');
    if (!token.includes('PushToken[')) {
      continue;
    }

    const existingTokens = tokensByUser.get(String(tokenRow.user_id)) ?? [];
    existingTokens.push(token);
    tokensByUser.set(String(tokenRow.user_id), existingTokens);
  }

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const recipientTokens = tokensByUser.get(row.recipient_user_id) ?? [];
    if (!recipientTokens.length) {
      await supabase
        .from('notification_outbox')
        .update({
          status: 'failed',
          attempt_count: row.attempt_count + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: 'No Expo push tokens registered for recipient.',
        })
        .eq('id', row.id);
      failed += 1;
      continue;
    }

    const content = buildNotificationContent(row.kind);
    const payload = row.payload ?? {};
    const messages = recipientTokens.map((token) => ({
      to: token,
      title: content.title,
      body: content.body,
      data: {
        notification_id: row.id,
        kind: row.kind,
        ...payload,
      },
      sound: 'default',
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const responseBody = await response.json().catch(() => null);
    const tickets = Array.isArray(responseBody?.data) ? responseBody.data : [];
    const hasSuccess = tickets.some((ticket: any) => ticket?.status === 'ok');

    await supabase
      .from('notification_outbox')
      .update({
        status: hasSuccess ? 'sent' : 'failed',
        attempt_count: row.attempt_count + 1,
        last_attempt_at: new Date().toISOString(),
        delivered_at: hasSuccess ? new Date().toISOString() : null,
        last_error: hasSuccess ? null : JSON.stringify(responseBody ?? { error: 'Unknown Expo push response' }),
      })
      .eq('id', row.id);

    if (hasSuccess) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return jsonResponse({
    processed: rows.length,
    sent,
    failed,
  });
});
