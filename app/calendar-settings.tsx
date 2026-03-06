import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import type { CalendarProvider } from '@/types/domain';
import { getMyPreferences, setCalendarSettings } from '@/services/preferences-service';

const PROVIDERS: CalendarProvider[] = ['none', 'apple', 'google', 'outlook', 'ical'];

export default function CalendarSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<CalendarProvider>('none');
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const prefs = await getMyPreferences();
        setProvider((prefs?.connected_calendar_provider as CalendarProvider) ?? 'none');
        setPushEnabled(prefs?.calendar_push_enabled ?? false);
      } catch {
        Alert.alert('Error', 'Could not load calendar settings.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const persist = async (nextProvider: CalendarProvider, nextPushEnabled: boolean) => {
    setSaving(true);
    try {
      await setCalendarSettings(nextProvider, nextPushEnabled);
    } catch (error: any) {
      Alert.alert('Save failed', error?.message ?? 'Could not update calendar settings.');
    } finally {
      setSaving(false);
    }
  };

  const onSelectProvider = async (nextProvider: CalendarProvider) => {
    setProvider(nextProvider);
    await persist(nextProvider, pushEnabled);
  };

  const onTogglePush = async (enabled: boolean) => {
    setPushEnabled(enabled);
    await persist(provider, enabled);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color="#FF9500" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connected Calendars</Text>
      <Text style={styles.subtitle}>Choose your preferred calendar provider and sync behavior.</Text>

      <View style={styles.providers}>
        {PROVIDERS.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.providerButton, provider === item && styles.providerButtonActive]}
            onPress={() => void onSelectProvider(item)}
            disabled={saving}
          >
            <Text style={[styles.providerText, provider === item && styles.providerTextActive]}>{item.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Push Planny events to selected calendar</Text>
        <Switch
          value={pushEnabled}
          onValueChange={(enabled) => void onTogglePush(enabled)}
          trackColor={{ false: '#EAEAEA', true: '#FF9500' }}
          disabled={saving || provider === 'none'}
        />
      </View>

      {saving && <ActivityIndicator color="#FF9500" style={{ marginTop: 18 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  title: {
    marginTop: 12,
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    marginTop: 8,
    color: '#666',
    marginBottom: 16,
  },
  providers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerButton: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
  },
  providerButtonActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  providerText: {
    color: '#555',
    fontSize: 12,
    fontWeight: '600',
  },
  providerTextActive: {
    color: '#fff',
  },
  switchRow: {
    marginTop: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchText: {
    color: '#333',
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
});
