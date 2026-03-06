import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/utils/supabase';
import { updateMyDisplayName } from '@/services/profile-service';

export default function ProfileSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          setEmail(authData.user.email ?? '');
          const fallbackName = authData.user.user_metadata?.display_name ?? authData.user.email?.split('@')[0] ?? '';

          const { data } = await supabase
            .from('users')
            .select('display_name')
            .eq('id', authData.user.id)
            .maybeSingle();

          setDisplayName(data?.display_name ?? fallbackName);
        }
      } catch {
        Alert.alert('Error', 'Could not load profile settings.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const onSave = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Display name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      await updateMyDisplayName(trimmed);
      Alert.alert('Saved', 'Profile settings updated.');
    } catch (error: any) {
      Alert.alert('Save failed', error?.message ?? 'Could not update profile settings.');
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
      <Text style={styles.title}>Profile Settings</Text>
      <Text style={styles.subtitle}>Update your display name and account details.</Text>

      <Text style={styles.label}>Display Name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Your display name"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={[styles.input, styles.inputDisabled]}
        value={email}
        editable={false}
      />

      <TouchableOpacity style={styles.saveButton} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Profile</Text>}
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
    marginBottom: 20,
  },
  label: {
    color: '#333',
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    padding: 12,
    marginBottom: 8,
  },
  inputDisabled: {
    color: '#777',
  },
  saveButton: {
    marginTop: 18,
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
