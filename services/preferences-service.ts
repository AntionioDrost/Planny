import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CalendarProvider, UserPreferences, VisibilityLevel } from '@/types/domain';
import { supabase } from '@/utils/supabase';

const LOCAL_SETTINGS_KEY = 'planny_local_profile_settings_v1';

type LocalSettings = {
  push_notifications_enabled: boolean;
  connected_calendar_provider: CalendarProvider;
  calendar_push_enabled: boolean;
};

const defaultLocalSettings: LocalSettings = {
  push_notifications_enabled: true,
  connected_calendar_provider: 'none',
  calendar_push_enabled: false,
};

function isMissingColumnError(error: any) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('column') && message.includes('does not exist');
}

function isMissingPreferencesTableError(error: any) {
  const message = String(error?.message ?? '').toLowerCase();
  return (
    error?.code === 'PGRST205' ||
    error?.code === 'PGRST204' ||
    (message.includes('public.user_preferences') && message.includes('schema cache')) ||
    (message.includes('relation') && message.includes('user_preferences') && message.includes('does not exist'))
  );
}

async function readLocalSettings(): Promise<LocalSettings> {
  try {
    const value = await AsyncStorage.getItem(LOCAL_SETTINGS_KEY);
    if (!value) return defaultLocalSettings;
    return { ...defaultLocalSettings, ...JSON.parse(value) };
  } catch {
    return defaultLocalSettings;
  }
}

async function writeLocalSettings(partial: Partial<LocalSettings>) {
  const current = await readLocalSettings();
  const safePartial = Object.fromEntries(
    Object.entries(partial).filter(([, value]) => value !== undefined)
  ) as Partial<LocalSettings>;
  const next = { ...current, ...safePartial };
  await AsyncStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export async function getMyPreferences(): Promise<UserPreferences | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return null;

  const local = await readLocalSettings();

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error) || isMissingPreferencesTableError(error)) {
      return {
        user_id: authData.user.id,
        default_existing_visibility: 'busy_only',
        hide_everything_enabled: false,
        sleep_start_local: '23:00',
        sleep_end_local: '07:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notification_privacy_mode: 'generic',
        push_notifications_enabled: local.push_notifications_enabled,
        connected_calendar_provider: local.connected_calendar_provider,
        calendar_push_enabled: local.calendar_push_enabled,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    throw error;
  }

  if (!data) {
    return {
      user_id: authData.user.id,
      default_existing_visibility: 'busy_only',
      hide_everything_enabled: false,
      sleep_start_local: '23:00',
      sleep_end_local: '07:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      notification_privacy_mode: 'generic',
      push_notifications_enabled: local.push_notifications_enabled,
      connected_calendar_provider: local.connected_calendar_provider,
      calendar_push_enabled: local.calendar_push_enabled,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return {
    ...data,
    push_notifications_enabled: data.push_notifications_enabled ?? local.push_notifications_enabled,
    connected_calendar_provider: data.connected_calendar_provider ?? local.connected_calendar_provider,
    calendar_push_enabled: data.calendar_push_enabled ?? local.calendar_push_enabled,
  };
}

export async function upsertMyPreferences(
  input: Partial<Pick<UserPreferences, 'default_existing_visibility' | 'hide_everything_enabled' | 'sleep_start_local' | 'sleep_end_local' | 'timezone' | 'push_notifications_enabled' | 'connected_calendar_provider' | 'calendar_push_enabled'>>
) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Not authenticated');

  await writeLocalSettings({
    push_notifications_enabled: input.push_notifications_enabled,
    connected_calendar_provider: input.connected_calendar_provider,
    calendar_push_enabled: input.calendar_push_enabled,
  });

  const payload = {
    user_id: authData.user.id,
    default_existing_visibility: (input.default_existing_visibility ?? 'busy_only') as VisibilityLevel,
    hide_everything_enabled: input.hide_everything_enabled ?? false,
    sleep_start_local: input.sleep_start_local ?? '23:00',
    sleep_end_local: input.sleep_end_local ?? '07:00',
    timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    push_notifications_enabled: input.push_notifications_enabled ?? true,
    connected_calendar_provider: input.connected_calendar_provider ?? 'none',
    calendar_push_enabled: input.calendar_push_enabled ?? false,
  };

  const { error } = await supabase
    .from('user_preferences')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) {
    if (isMissingColumnError(error) || isMissingPreferencesTableError(error)) {
      return;
    }
    throw error;
  }
}

export async function setHideEverything(enabled: boolean) {
  await upsertMyPreferences({ hide_everything_enabled: enabled });
}

export async function setPushNotificationsEnabled(enabled: boolean) {
  await upsertMyPreferences({ push_notifications_enabled: enabled });
}

export async function setCalendarSettings(provider: CalendarProvider, calendarPushEnabled: boolean) {
  await upsertMyPreferences({
    connected_calendar_provider: provider,
    calendar_push_enabled: calendarPushEnabled,
  });
}
