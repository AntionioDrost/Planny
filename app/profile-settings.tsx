import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { UserAvatar } from '@/components/user-avatar';
import {
  getMyProfile,
  pickProfileImage,
  type PickedProfileImage,
  updateMyDisplayName,
  uploadMyAvatar,
} from '@/services/profile-service';

export default function ProfileSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [initialDisplayName, setInitialDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<PickedProfileImage | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getMyProfile();
        if (profile) {
          const resolvedName = profile.display_name ?? '';
          setDisplayName(resolvedName);
          setInitialDisplayName(resolvedName);
          setEmail(profile.email ?? '');
          setAvatarUrl(profile.avatar_url);
        }
      } catch (error: any) {
        Alert.alert('Error', error?.message ?? 'Could not load profile settings.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const previewAvatarUrl = useMemo(() => selectedImage?.uri ?? avatarUrl, [avatarUrl, selectedImage?.uri]);

  const handlePickPhoto = async () => {
    try {
      const asset = await pickProfileImage();
      if (!asset) {
        return;
      }

      setSelectedImage(asset);
    } catch (error: any) {
      Alert.alert('Photo unavailable', error?.message ?? 'Could not open your photo library.');
    }
  };

  const onSave = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Display name cannot be empty.');
      return;
    }

    const hasNameChange = trimmed !== initialDisplayName;
    const hasImageChange = Boolean(selectedImage);

    if (!hasNameChange && !hasImageChange) {
      Alert.alert('No changes', 'Your profile is already up to date.');
      return;
    }

    setSaving(true);
    try {
      if (hasNameChange) {
        await updateMyDisplayName(trimmed);
        setInitialDisplayName(trimmed);
      }

      if (selectedImage) {
        const uploadedAvatarUrl = await uploadMyAvatar(selectedImage);
        setAvatarUrl(uploadedAvatarUrl);
        setSelectedImage(null);
      }

      Alert.alert('Saved', 'Profile settings updated.');
    } catch (error: any) {
      Alert.alert('Save failed', error?.message ?? 'Could not update profile settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { justifyContent: 'center' }]}>
        <ActivityIndicator color="#FF9500" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile Settings</Text>
      <Text style={styles.subtitle}>Add a photo and update the name people see when you connect.</Text>

      <View style={styles.photoCard}>
        <UserAvatar
          avatarUrl={previewAvatarUrl}
          name={displayName || 'Your Profile'}
          size={108}
          style={styles.avatar}
        />
        <Text style={styles.photoTitle}>Profile Photo</Text>
        <Text style={styles.photoHint}>This photo will appear in connection celebrations and on shared profile surfaces.</Text>
        <TouchableOpacity style={styles.photoButton} onPress={handlePickPhoto} disabled={saving}>
          <Text style={styles.photoButtonText}>{previewAvatarUrl ? 'Change Photo' : 'Choose Photo'}</Text>
        </TouchableOpacity>
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFF9F2',
    padding: 24,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF9F2',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
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
    marginBottom: 22,
    lineHeight: 21,
  },
  photoCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#F2E3CF',
    marginBottom: 24,
  },
  avatar: {
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 4,
  },
  photoTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  photoHint: {
    marginTop: 8,
    maxWidth: 280,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  photoButton: {
    marginTop: 18,
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
    backgroundColor: '#111',
  },
  photoButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  label: {
    color: '#333',
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E8DED1',
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 14,
    marginBottom: 8,
    fontSize: 16,
  },
  inputDisabled: {
    color: '#777',
    backgroundColor: '#F6F1EA',
  },
  saveButton: {
    marginTop: 18,
    backgroundColor: '#FF9500',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
