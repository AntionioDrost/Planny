import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { VISIBILITY_LABELS, VISIBILITY_LEVELS } from '@/constants/visibility';
import type { VisibilityLevel } from '@/types/domain';
import { getMyPreferences, upsertMyPreferences } from '@/services/preferences-service';

export default function PrivacySettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultVisibility, setDefaultVisibility] = useState<VisibilityLevel>('busy_only');
  const [sleepStart, setSleepStart] = useState('23:00');
  const [sleepEnd, setSleepEnd] = useState('07:00');

  useEffect(() => {
    const load = async () => {
      try {
        const prefs = await getMyPreferences();
        if (prefs) {
          setDefaultVisibility(prefs.default_existing_visibility);
          setSleepStart(prefs.sleep_start_local.slice(0, 5));
          setSleepEnd(prefs.sleep_end_local.slice(0, 5));
        }
      } catch {
        Alert.alert('Error', 'Could not load privacy settings.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await upsertMyPreferences({
        default_existing_visibility: defaultVisibility,
        sleep_start_local: sleepStart,
        sleep_end_local: sleepEnd,
      });
      Alert.alert('Saved', 'Privacy defaults updated.');
    } catch (error: any) {
      Alert.alert('Save failed', error?.message ?? 'Could not save privacy settings.');
    } finally {
      setSaving(false);
    }
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
      <Text style={styles.title}>Privacy Defaults</Text>
      <Text style={styles.subtitle}>Choose what new connections see on existing events.</Text>

      <View style={styles.optionGrid}>
        {VISIBILITY_LEVELS.map((level) => (
          <TouchableOpacity
            key={level}
            style={[styles.option, defaultVisibility === level && styles.optionActive]}
            onPress={() => setDefaultVisibility(level)}
          >
            <Text style={[styles.optionText, defaultVisibility === level && styles.optionTextActive]}>
              {VISIBILITY_LABELS[level]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.section}>Sleep Hours (local)</Text>
      <TextInput value={sleepStart} onChangeText={setSleepStart} style={styles.input} placeholder="23:00" />
      <TextInput value={sleepEnd} onChangeText={setSleepEnd} style={styles.input} placeholder="07:00" />

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Settings</Text>}
      </TouchableOpacity>
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
  section: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FAFAFA',
  },
  optionActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  optionText: {
    fontSize: 13,
    color: '#555',
  },
  optionTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#F5F5F5',
  },
  saveButton: {
    marginTop: 14,
    backgroundColor: '#FF9500',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
  },
});
