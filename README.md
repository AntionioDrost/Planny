# Planny

Planny is an Expo Router app backed by Supabase. It focuses on privacy-aware planning, mutual connections, proposal workflows, device calendar sync, and push notifications.

## Requirements

- Node 20+
- Expo SDK 54 toolchain
- A Supabase project with the migrations in `supabase/migrations`
- A native iOS/Android build for device calendar sync and remote push testing

## Environment

Create a local `.env` file from `.env.example` and set:

```bash
EXPO_PUBLIC_APP_ENV=dev
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL=planny://reset-password
EXPO_PUBLIC_FEATURE_FLAGS=proposals,export,hide_everything
EXPO_PUBLIC_SHOW_CONFIG_WARNINGS=1
```

Without the Supabase URL + anon key the app will load the shell, but auth and backend flows stay disabled on purpose.

## Supabase Auth Email Setup

Password reset emails require both a valid redirect URL and SMTP delivery in Supabase.

In the Supabase Dashboard for the Planny project:

1. Open `Authentication > URL Configuration`.
2. Set `Site URL` to `planny://reset-password`.
3. Add these redirect URLs:
   - `planny://reset-password`
   - `planny:///reset-password`
   - `exp://**/--/reset-password` for Expo Go testing
   - `http://localhost:8081/reset-password` for local web testing
   - `http://127.0.0.1:8081/reset-password` for local web testing
4. Open `Authentication > SMTP Settings`.
5. Enable custom SMTP and fill in your provider details:
   - SMTP host
   - SMTP port, usually `587`
   - SMTP user
   - SMTP password
   - Sender email, for example `no-reply@yourdomain.com`
   - Sender name, for example `Planny`

Supabase's default email service only sends to authorized team member addresses, so real users need custom SMTP.

## Install and Run

```bash
npm install
npx expo start
```

Remote push notifications are not fully supported in Expo Go. Use a development build for push registration and native calendar sync.

## Supabase Setup

Apply the SQL migrations in order:

```bash
supabase db push
```

Important runtime pieces added in this repo:

- `20260410000000_completeness_runtime.sql`
  - seeds `event_visibility` for existing events when a connection becomes `active`
  - enqueues notification outbox rows for invites, responses, proposals, and connection confirmations
  - tracks delivery attempts on `notification_outbox`
- `20260418010000_avatar_storage.sql`
  - creates the public `avatars` storage bucket and profile-image policies

Deploy the edge functions:

```bash
supabase functions deploy issue_qr_payload
supabase functions deploy register_qr_scan
supabase functions deploy create_event_bundle
supabase functions deploy propose_event_time
supabase functions deploy respond_event_proposal
supabase functions deploy export_user_data
supabase functions deploy send_notification
supabase functions deploy deliver_notifications
```

`deliver_notifications` needs:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Invoke `deliver_notifications` from your scheduler/cron to drain the queued notification outbox.

## Native Features

### Device Calendars

- Calendar selection is device-local.
- Users pick which device calendars Planny reads for conflicts.
- If sync is enabled, owned Planny events are mirrored to the selected writable device calendars.

### Push Notifications

- Push opt-in is handled on-device with `expo-notifications`.
- Tokens are stored in `public.device_push_tokens`.
- Database triggers enqueue notification rows in `public.notification_outbox`.
- `deliver_notifications` sends those rows through Expo Push.

## Checks

```bash
npm run lint
npx tsc --noEmit
```
