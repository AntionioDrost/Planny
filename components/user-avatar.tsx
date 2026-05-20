import React, { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';

type UserAvatarProps = {
  avatarUrl?: string | null;
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function UserAvatar({
  avatarUrl,
  name,
  size = 48,
  style,
  textStyle,
}: UserAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [avatarUrl]);

  const initial = name?.trim().charAt(0).toUpperCase() || 'U';
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  return (
    <View style={[styles.container, avatarStyle, style]}>
      {avatarUrl && !hasImageError ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[StyleSheet.absoluteFillObject, avatarStyle]}
          contentFit="cover"
          transition={120}
          onError={() => setHasImageError(true)}
        />
      ) : (
        <Text style={[styles.text, { fontSize: Math.round(size * 0.42) }, textStyle]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FF9500',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
  },
});
