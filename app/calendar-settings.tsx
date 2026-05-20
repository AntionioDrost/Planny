import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DeviceCalendarOption } from '@/types/domain';
import {
  clearAllSyncedCalendarEvents,
  deriveLegacyCalendarProvider,
  getLocalCalendarSettings,
  groupCalendarsByProvider,
  hasDeviceCalendarAccess,
  isNativeCalendarSupported,
  listDeviceCalendars,
  pruneSyncedEventsForDeselectedCalendars,
  requestDeviceCalendarAccess,
  setDeviceCalendarSyncEnabled,
  setSelectedDeviceCalendars,
  syncPlannyEventToDeviceCalendars,
} from '@/services/device-calendar-service';
import { listOwnedEventsForSync } from '@/services/event-service';
import { setCalendarSettings } from '@/services/preferences-service';

function formatProvider(provider: string) {
  return provider === 'ical' ? 'iCal' : provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default function CalendarSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [calendars, setCalendars] = useState<DeviceCalendarOption[]>([]);
  const insets = useSafeAreaInsets();

  const selectedSet = new Set(selectedCalendarIds);
  const selectedWritableCalendarCount = calendars.filter(
    (calendar) => selectedSet.has(calendar.id) && calendar.allowsModifications
  ).length;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/user' as any);
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
      <TouchableOpacity
        accessibilityLabel="Go back"
        accessibilityRole="button"
        hitSlop={12}
        onPress={handleBack}
        style={styles.backButton}
      >
        <ArrowLeft size={24} color="#111" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Connected Calendars</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  const load = async (grantIfNeeded: boolean) => {
    setLoading(true);
    try {
      if (!isNativeCalendarSupported) {
        setPermissionGranted(false);
        setCalendars([]);
        setSelectedCalendarIds([]);
        setSyncEnabled(false);
        return;
      }

      const granted = grantIfNeeded
        ? await requestDeviceCalendarAccess()
        : await hasDeviceCalendarAccess();
      setPermissionGranted(granted);

      if (!granted) {
        setCalendars([]);
        return;
      }

      const [deviceCalendars, localSettings] = await Promise.all([
        listDeviceCalendars(),
        getLocalCalendarSettings(),
      ]);

      setCalendars(deviceCalendars);
      setSelectedCalendarIds(localSettings.selectedCalendarIds);
      setSyncEnabled(localSettings.syncEnabled);
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Could not load device calendars.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(true);
  }, []);

  const mirrorLegacyPreferences = async (
    nextSelectedIds: string[],
    nextCalendars: DeviceCalendarOption[],
    nextSyncEnabled: boolean
  ) => {
    const selectedCalendars = nextCalendars.filter((calendar) => nextSelectedIds.includes(calendar.id));
    const legacyProvider = deriveLegacyCalendarProvider(selectedCalendars);
    await setCalendarSettings(legacyProvider, nextSyncEnabled);
  };

  const backfillSelectedCalendars = async () => {
    const ownedEvents = await listOwnedEventsForSync();
    for (const event of ownedEvents) {
      await syncPlannyEventToDeviceCalendars(event);
    }
  };

  const onToggleCalendar = async (calendarId: string) => {
    const nextSelectedIds = selectedSet.has(calendarId)
      ? selectedCalendarIds.filter((id) => id !== calendarId)
      : [...selectedCalendarIds, calendarId];

    setSelectedCalendarIds(nextSelectedIds);
    setCalendars((prev) =>
      prev.map((calendar) =>
        calendar.id === calendarId ? { ...calendar, selected: !calendar.selected } : calendar
      )
    );

    setSaving(true);
    try {
      await pruneSyncedEventsForDeselectedCalendars(nextSelectedIds);
      await setSelectedDeviceCalendars(nextSelectedIds);
      await mirrorLegacyPreferences(nextSelectedIds, calendars, syncEnabled);

      if (syncEnabled && nextSelectedIds.length > 0) {
        try {
          await backfillSelectedCalendars();
        } catch (backfillError: any) {
          Alert.alert(
            'Calendars updated',
            backfillError?.message ?? 'Selected calendars were saved, but existing events could not be synced yet.'
          );
        }
      }
    } catch (error: any) {
      Alert.alert('Save failed', error?.message ?? 'Could not update selected calendars.');
      await load(false);
    } finally {
      setSaving(false);
    }
  };

  const onToggleSync = async (enabled: boolean) => {
    if (enabled && selectedWritableCalendarCount === 0) {
      Alert.alert('Select a calendar first', 'Choose at least one writable device calendar before enabling sync.');
      return;
    }

    setSyncEnabled(enabled);
    setSaving(true);

    try {
      await setDeviceCalendarSyncEnabled(enabled);
      await mirrorLegacyPreferences(selectedCalendarIds, calendars, enabled);

      if (enabled) {
        try {
          await backfillSelectedCalendars();
        } catch (backfillError: any) {
          Alert.alert(
            'Sync enabled',
            backfillError?.message ?? 'Calendar sync was enabled, but existing events could not be mirrored yet.'
          );
        }
      } else {
        await clearAllSyncedCalendarEvents();
      }
    } catch (error: any) {
      setSyncEnabled(!enabled);
      Alert.alert('Save failed', error?.message ?? 'Could not update calendar sync settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingState}>
          <ActivityIndicator color="#FF9500" />
        </View>
      </View>
    );
  }

  if (!isNativeCalendarSupported || Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.staticContent}>
          <Text style={styles.title}>Connected Calendars</Text>
          <Text style={styles.subtitle}>
            Device calendar sync is available on iOS and Android builds. Web stays read-only for now.
          </Text>
        </View>
      </View>
    );
  }

  if (!permissionGranted) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.staticContent}>
          <Text style={styles.title}>Connected Calendars</Text>
          <Text style={styles.subtitle}>
            Grant calendar access so Planny can check conflicts and sync your confirmed plans to your device calendars.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={() => void load(true)}>
            <Text style={styles.primaryButtonText}>Grant Calendar Access</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const groupedCalendars = groupCalendarsByProvider(
    calendars.map((calendar) => ({
      ...calendar,
      selected: selectedSet.has(calendar.id),
    }))
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Connected Calendars</Text>
        <Text style={styles.subtitle}>
          Select which device calendars Planny should read for conflicts and optionally keep in sync.
        </Text>

        <View style={styles.syncCard}>
          <View style={styles.syncHeader}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.syncTitle}>Write Planny events to selected calendars</Text>
              <Text style={styles.syncDescription}>
                Existing and future plans you create in Planny will be mirrored to the calendars selected below.
              </Text>
            </View>
            <Switch
              value={syncEnabled}
              onValueChange={(value) => void onToggleSync(value)}
              trackColor={{ false: '#EAEAEA', true: '#FF9500' }}
              disabled={saving}
            />
          </View>
        </View>

        {groupedCalendars.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No device calendars found</Text>
            <Text style={styles.emptyDescription}>
              Add at least one writable calendar in the operating system before enabling Planny sync.
            </Text>
          </View>
        )}

        {groupedCalendars.map((group) => (
          <View key={group.provider} style={styles.group}>
            <Text style={styles.groupTitle}>{formatProvider(group.provider)}</Text>
            {group.calendars.map((calendar) => (
              <TouchableOpacity
                key={calendar.id}
                style={[styles.calendarRow, selectedSet.has(calendar.id) && styles.calendarRowSelected]}
                onPress={() => void onToggleCalendar(calendar.id)}
                disabled={saving}
              >
                <View style={styles.calendarInfo}>
                  <View style={[styles.colorDot, { backgroundColor: calendar.color ?? '#FF9500' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calendarTitle}>{calendar.title}</Text>
                    <Text style={styles.calendarMeta}>
                      {calendar.sourceName ?? calendar.ownerAccount ?? 'Device calendar'}
                      {calendar.allowsModifications ? '' : ' - Read only'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.checkbox, selectedSet.has(calendar.id) && styles.checkboxSelected]}>
                  {selectedSet.has(calendar.id) && <View style={styles.checkboxInner} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {saving && <ActivityIndicator color="#FF9500" style={{ marginTop: 16 }} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
  },
  staticContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    marginTop: 8,
    color: '#666',
    marginBottom: 16,
    lineHeight: 21,
  },
  syncCard: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  syncDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    backgroundColor: '#FAFAFA',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#FF9500',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  group: {
    marginBottom: 18,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  calendarRow: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarRowSelected: {
    borderColor: '#FF9500',
    backgroundColor: '#FFF7ED',
  },
  calendarInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginRight: 12,
  },
  calendarTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  calendarMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D3D3D3',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    borderColor: '#FF9500',
    backgroundColor: '#FF9500',
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
});
