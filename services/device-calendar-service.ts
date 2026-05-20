import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import type {
  CalendarProvider,
  DetectedCalendarProvider,
  DeviceCalendarOption,
  DeviceCalendarSettings,
  SyncableCalendarEvent,
  SyncedCalendarEventMapping,
} from '@/types/domain';

const CALENDAR_SETTINGS_KEY = 'planny_device_calendar_settings_v1';
const CALENDAR_EVENT_MAPPINGS_KEY = 'planny_device_calendar_event_mappings_v1';

type StoredCalendarMappings = Record<string, SyncedCalendarEventMapping[]>;

const defaultSettings: DeviceCalendarSettings = {
  selectedCalendarIds: [],
  syncEnabled: false,
  updatedAt: new Date(0).toISOString(),
};

export const isNativeCalendarSupported = Platform.OS === 'ios' || Platform.OS === 'android';

function toIsoNow() {
  return new Date().toISOString();
}

function normalizeSettings(input?: Partial<DeviceCalendarSettings>): DeviceCalendarSettings {
  return {
    selectedCalendarIds: input?.selectedCalendarIds ?? [],
    syncEnabled: input?.syncEnabled ?? false,
    updatedAt: input?.updatedAt ?? toIsoNow(),
  };
}

async function readStoredMappings(): Promise<StoredCalendarMappings> {
  try {
    const value = await AsyncStorage.getItem(CALENDAR_EVENT_MAPPINGS_KEY);
    if (!value) return {};
    return JSON.parse(value) as StoredCalendarMappings;
  } catch {
    return {};
  }
}

async function writeStoredMappings(mappings: StoredCalendarMappings) {
  await AsyncStorage.setItem(CALENDAR_EVENT_MAPPINGS_KEY, JSON.stringify(mappings));
}

async function writeSettings(next: DeviceCalendarSettings) {
  await AsyncStorage.setItem(CALENDAR_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

function inferCalendarProvider(calendar: any): DetectedCalendarProvider {
  const source = [
    calendar?.title,
    calendar?.name,
    calendar?.ownerAccount,
    calendar?.source?.name,
    calendar?.source?.type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (source.includes('google') || source.includes('gmail')) return 'google';
  if (source.includes('outlook') || source.includes('exchange') || source.includes('office')) return 'outlook';
  if (source.includes('ical') || source.includes('ics') || source.includes('subscribed')) return 'ical';
  if (Platform.OS === 'ios') return 'apple';
  return 'other';
}

function toDeviceCalendarOption(calendar: any, selectedCalendarIds: Set<string>): DeviceCalendarOption {
  return {
    id: String(calendar.id),
    title: calendar.title ?? calendar.name ?? 'Untitled calendar',
    color: calendar.color ?? null,
    allowsModifications: calendar.allowsModifications !== false,
    provider: inferCalendarProvider(calendar),
    sourceName: calendar.source?.name ?? null,
    ownerAccount: calendar.ownerAccount ?? null,
    selected: selectedCalendarIds.has(String(calendar.id)),
  };
}

function buildCalendarEventDetails(event: SyncableCalendarEvent) {
  return {
    title: event.title,
    startDate: new Date(event.start_at_utc),
    endDate: new Date(event.end_at_utc),
    allDay: event.is_all_day,
    location: event.location ?? undefined,
    notes: event.notes ?? undefined,
    timeZone: event.timezone,
  };
}

function overlaps(windowStart: Date, windowEnd: Date, start: Date, end: Date) {
  return start < windowEnd && end > windowStart;
}

async function ensureCalendarPermission(grantIfNeeded = false) {
  if (!isNativeCalendarSupported) {
    return false;
  }

  const current = await Calendar.getCalendarPermissionsAsync();
  if (current.granted) {
    return true;
  }

  if (!grantIfNeeded) {
    return false;
  }

  const requested = await Calendar.requestCalendarPermissionsAsync();
  return requested.granted;
}

async function getAvailableCalendars() {
  if (!(await ensureCalendarPermission(false))) {
    return [] as any[];
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendars.filter((calendar) => Boolean(calendar.id));
}

export async function getLocalCalendarSettings() {
  try {
    const value = await AsyncStorage.getItem(CALENDAR_SETTINGS_KEY);
    if (!value) return defaultSettings;
    return normalizeSettings(JSON.parse(value) as Partial<DeviceCalendarSettings>);
  } catch {
    return defaultSettings;
  }
}

export async function requestDeviceCalendarAccess() {
  return ensureCalendarPermission(true);
}

export async function hasDeviceCalendarAccess() {
  return ensureCalendarPermission(false);
}

export async function listDeviceCalendars() {
  const settings = await getLocalCalendarSettings();
  const calendars = await getAvailableCalendars();
  const selectedSet = new Set(settings.selectedCalendarIds);

  return calendars
    .map((calendar) => toDeviceCalendarOption(calendar, selectedSet))
    .sort((left, right) => left.title.localeCompare(right.title));
}

export async function setSelectedDeviceCalendars(selectedCalendarIds: string[]) {
  const current = await getLocalCalendarSettings();
  return writeSettings(
    normalizeSettings({
      ...current,
      selectedCalendarIds,
      updatedAt: toIsoNow(),
    })
  );
}

export async function setDeviceCalendarSyncEnabled(syncEnabled: boolean) {
  const current = await getLocalCalendarSettings();
  return writeSettings(
    normalizeSettings({
      ...current,
      syncEnabled,
      updatedAt: toIsoNow(),
    })
  );
}

export async function getDeviceCalendarConflicts(windowStart: Date, windowEnd: Date) {
  const settings = await getLocalCalendarSettings();
  if (!settings.selectedCalendarIds.length || !(await ensureCalendarPermission(false))) {
    return [];
  }

  const events = await Calendar.getEventsAsync(settings.selectedCalendarIds, windowStart, windowEnd);
  return events
    .filter((event) => {
      const startDate = event.startDate ? new Date(event.startDate) : null;
      const endDate = event.endDate ? new Date(event.endDate) : null;
      if (!startDate || !endDate) return false;
      return overlaps(windowStart, windowEnd, startDate, endDate);
    })
    .map((event) => ({
      id: String(event.id),
      title: event.title ?? 'Calendar event',
      calendarId: String(event.calendarId),
      startDate: new Date(event.startDate),
      endDate: new Date(event.endDate),
    }));
}

export async function syncPlannyEventToDeviceCalendars(event: SyncableCalendarEvent) {
  const settings = await getLocalCalendarSettings();
  const mappings = await readStoredMappings();
  const existingMappings = mappings[event.id] ?? [];

  if (!settings.syncEnabled || !settings.selectedCalendarIds.length || !(await ensureCalendarPermission(false))) {
    return {
      skipped: true,
      reason: 'Calendar sync is disabled or no writable calendars are selected.',
    };
  }

  const calendars = await getAvailableCalendars();
  const calendarById = new Map(calendars.map((calendar) => [String(calendar.id), calendar]));
  const selectedIds = new Set(settings.selectedCalendarIds);
  const nextMappings: SyncedCalendarEventMapping[] = [];

  for (const mapping of existingMappings) {
    if (!selectedIds.has(mapping.calendarId) || event.status === 'canceled') {
      try {
        await Calendar.deleteEventAsync(mapping.nativeEventId);
      } catch {
        // Ignore stale calendar references during cleanup.
      }
      continue;
    }
  }

  if (event.status === 'canceled') {
    delete mappings[event.id];
    await writeStoredMappings(mappings);
    return { skipped: false, syncedCalendars: 0, removedCalendars: existingMappings.length };
  }

  const eventDetails = buildCalendarEventDetails(event);

  for (const calendarId of settings.selectedCalendarIds) {
    const calendar = calendarById.get(calendarId);
    if (!calendar || calendar.allowsModifications === false) {
      continue;
    }

    const existingMapping = existingMappings.find((mapping) => mapping.calendarId === calendarId);
    let nativeEventId = existingMapping?.nativeEventId;

    if (nativeEventId) {
      try {
        await Calendar.updateEventAsync(nativeEventId, eventDetails);
      } catch {
        nativeEventId = undefined;
      }
    }

    if (!nativeEventId) {
      nativeEventId = await Calendar.createEventAsync(calendarId, eventDetails);
    }

    nextMappings.push({
      calendarId,
      nativeEventId,
      provider: inferCalendarProvider(calendar),
    });
  }

  mappings[event.id] = nextMappings;
  await writeStoredMappings(mappings);

  return {
    skipped: false,
    syncedCalendars: nextMappings.length,
    removedCalendars: Math.max(existingMappings.length - nextMappings.length, 0),
  };
}

export async function clearAllSyncedCalendarEvents() {
  const mappings = await readStoredMappings();
  const entries = Object.entries(mappings);

  for (const [, eventMappings] of entries) {
    for (const mapping of eventMappings) {
      try {
        await Calendar.deleteEventAsync(mapping.nativeEventId);
      } catch {
        // Ignore stale native events during cleanup.
      }
    }
  }

  await writeStoredMappings({});
}

export async function pruneSyncedEventsForDeselectedCalendars(nextSelectedCalendarIds: string[]) {
  const nextSelected = new Set(nextSelectedCalendarIds);
  const mappings = await readStoredMappings();
  const nextMappings: StoredCalendarMappings = {};

  for (const [plannyEventId, eventMappings] of Object.entries(mappings)) {
    const retainedMappings: SyncedCalendarEventMapping[] = [];

    for (const mapping of eventMappings) {
      if (nextSelected.has(mapping.calendarId)) {
        retainedMappings.push(mapping);
        continue;
      }

      try {
        await Calendar.deleteEventAsync(mapping.nativeEventId);
      } catch {
        // Ignore stale native events during cleanup.
      }
    }

    if (retainedMappings.length) {
      nextMappings[plannyEventId] = retainedMappings;
    }
  }

  await writeStoredMappings(nextMappings);
}

export function deriveLegacyCalendarProvider(calendars: DeviceCalendarOption[]): CalendarProvider {
  if (!calendars.length) return 'none';

  const preferredOrder: Array<Exclude<CalendarProvider, 'none'>> = ['apple', 'google', 'outlook', 'ical'];
  for (const provider of preferredOrder) {
    if (calendars.some((calendar) => calendar.provider === provider)) {
      return provider;
    }
  }

  return 'none';
}

export function groupCalendarsByProvider(calendars: DeviceCalendarOption[]) {
  const order: DetectedCalendarProvider[] = ['apple', 'google', 'outlook', 'ical', 'other'];
  return order
    .map((provider) => ({
      provider,
      calendars: calendars.filter((calendar) => calendar.provider === provider),
    }))
    .filter((group) => group.calendars.length > 0);
}
