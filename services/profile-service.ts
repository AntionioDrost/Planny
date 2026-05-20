import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { UserSummary } from '@/types/domain';
import { supabase } from '@/utils/supabase';

function isMissingColumnError(error: any) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('column') && message.includes('does not exist');
}

export type PickedProfileImage = ImagePicker.ImagePickerAsset;

function createFallbackProfile(user: any): UserSummary {
  return {
    id: user.id,
    display_name: user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? 'Your Profile',
    email: user.email ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
  };
}

function getAvatarContentType(asset: PickedProfileImage) {
  const mimeType = asset.mimeType?.toLowerCase();

  if (mimeType === 'image/png' || mimeType === 'image/webp' || mimeType === 'image/heic') {
    return mimeType;
  }

  return 'image/jpeg';
}

function getAvatarStoragePath(userId: string, contentType: string) {
  const extensionByContentType: Record<string, string> = {
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  };
  const extension = extensionByContentType[contentType] ?? 'jpg';

  return `${userId}/profile.${extension}`;
}

async function resolveCurrentUser() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error('Not authenticated');
  return authData.user;
}

export async function getMyProfile(): Promise<UserSummary | null> {
  const user = await resolveCurrentUser();
  const fallbackProfile = createFallbackProfile(user);

  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, email, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) {
    return fallbackProfile;
  }

  return {
    id: data.id,
    display_name: data.display_name ?? fallbackProfile.display_name,
    email: data.email ?? fallbackProfile.email,
    avatar_url: data.avatar_url ?? fallbackProfile.avatar_url,
  };
}

export async function updateMyDisplayName(displayName: string) {
  const user = await resolveCurrentUser();

  await supabase.auth.updateUser({
    data: { display_name: displayName },
  });

  const { error } = await supabase
    .from('users')
    .update({ display_name: displayName })
    .eq('id', user.id);

  if (error) throw error;
}

export async function pickProfileImage(): Promise<PickedProfileImage | null> {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo access is needed so you can add a profile image.');
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  if (result.canceled) {
    return null;
  }

  return result.assets[0] ?? null;
}

export async function uploadMyAvatar(asset: PickedProfileImage): Promise<string> {
  const user = await resolveCurrentUser();
  const fileSource = (asset as PickedProfileImage & { file?: File }).file;
  const uploadPayload = fileSource ?? (await fetch(asset.uri).then((response) => response.arrayBuffer()));
  const contentType = getAvatarContentType(asset);
  const storagePath = getAvatarStoragePath(user.id, contentType);

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(storagePath, uploadPayload, {
      contentType,
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(storagePath);
  const avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: profileError } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id);

  if (profileError) {
    throw profileError;
  }

  await supabase.auth.updateUser({
    data: {
      avatar_url: avatarUrl,
    },
  }).catch(() => undefined);

  return avatarUrl;
}

export async function requestAccountDeletion() {
  const user = await resolveCurrentUser();

  const { error } = await supabase
    .from('users')
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error && !isMissingColumnError(error)) {
    throw error;
  }

  await supabase.auth.signOut();
}
