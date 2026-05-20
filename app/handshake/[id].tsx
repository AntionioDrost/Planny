import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Sparkles } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { UserAvatar } from '@/components/user-avatar';
import { getHandshake, getUsersByIds } from '@/services/connection-service';
import type { ConnectionHandshake, UserSummary } from '@/types/domain';
import { supabase } from '@/utils/supabase';

export default function HandshakeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [handshake, setHandshake] = useState<ConnectionHandshake | null>(null);
  const [participants, setParticipants] = useState<UserSummary[]>([]);
  const [viewerId, setViewerId] = useState('');
  const insets = useSafeAreaInsets();
  const animationStartedRef = useRef(false);

  const backgroundOpacity = useSharedValue(0);
  const sparklesOpacity = useSharedValue(0);
  const sparklesTranslateY = useSharedValue(18);
  const leftAvatarTranslateX = useSharedValue(-28);
  const rightAvatarTranslateX = useSharedValue(28);
  const avatarsScale = useSharedValue(0.82);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(16);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(14);

  const handshakeId = useMemo(() => (typeof id === 'string' ? id : ''), [id]);

  const loadHandshake = useCallback(
    async (silent = false) => {
      if (!handshakeId) return;

      try {
        const [{ data: authData }, handshakeData] = await Promise.all([
          supabase.auth.getUser(),
          getHandshake(handshakeId),
        ]);

        setViewerId(authData.user?.id ?? '');
        setHandshake(handshakeData);

        if (handshakeData.status === 'connected') {
          const users = await getUsersByIds([handshakeData.user_1_id, handshakeData.user_2_id]);
          setParticipants(users);
        }
      } catch (error: any) {
        if (!silent) {
          Alert.alert('Connection unavailable', error?.message ?? 'Could not load the new connection.');
        }
      } finally {
        setLoading(false);
      }
    },
    [handshakeId]
  );

  useEffect(() => {
    void loadHandshake();
  }, [loadHandshake]);

  const celebrationReady = handshake?.status === 'connected' && participants.length >= 2;

  useEffect(() => {
    if (!handshakeId || celebrationReady) {
      return;
    }

    const interval = setInterval(() => {
      void loadHandshake(true);
    }, 1500);

    return () => clearInterval(interval);
  }, [celebrationReady, handshakeId, loadHandshake]);

  useEffect(() => {
    if (!celebrationReady || animationStartedRef.current) {
      return;
    }

    animationStartedRef.current = true;

    backgroundOpacity.value = withTiming(1, { duration: 220 });
    sparklesOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    sparklesTranslateY.value = withDelay(100, withTiming(0, { duration: 300 }));
    avatarsScale.value = withDelay(180, withSpring(1, { damping: 13, stiffness: 140 }));
    leftAvatarTranslateX.value = withDelay(180, withSpring(0, { damping: 13, stiffness: 140 }));
    rightAvatarTranslateX.value = withDelay(220, withSpring(0, { damping: 13, stiffness: 140 }));
    textOpacity.value = withDelay(520, withTiming(1, { duration: 280 }));
    textTranslateY.value = withDelay(520, withTiming(0, { duration: 280 }));
    buttonOpacity.value = withDelay(760, withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }));
    buttonTranslateY.value = withDelay(760, withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) }));
  }, [
    avatarsScale,
    backgroundOpacity,
    buttonOpacity,
    buttonTranslateY,
    celebrationReady,
    leftAvatarTranslateX,
    rightAvatarTranslateX,
    sparklesOpacity,
    sparklesTranslateY,
    textOpacity,
    textTranslateY,
  ]);

  const orderedParticipants = useMemo(() => {
    if (participants.length < 2) {
      return participants;
    }

    const currentUser = participants.find((participant) => participant.id === viewerId);
    if (!currentUser) {
      return participants;
    }

    const otherUser = participants.find((participant) => participant.id !== viewerId);
    return otherUser ? [currentUser, otherUser] : participants;
  }, [participants, viewerId]);

  const [firstUser, secondUser] = orderedParticipants;
  const title =
    firstUser && secondUser
      ? `${firstUser.display_name || 'You'} and ${secondUser.display_name || 'your new connection'} are now connected`
      : 'You are now connected';

  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: sparklesOpacity.value,
    transform: [{ translateY: sparklesTranslateY.value }],
  }));

  const leftAvatarStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: leftAvatarTranslateX.value },
      { scale: avatarsScale.value },
    ],
  }));

  const rightAvatarStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: rightAvatarTranslateX.value },
      { scale: avatarsScale.value },
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View style={[styles.background, backgroundStyle]} />

      <Animated.View style={[styles.sparkle, styles.sparkleTopRight, sparkleStyle]}>
        <Sparkles color="#fff" size={72} strokeWidth={1.4} />
      </Animated.View>
      <Animated.View style={[styles.sparkle, styles.sparkleTopLeft, sparkleStyle]}>
        <Sparkles color="#fff" size={42} strokeWidth={1.8} />
      </Animated.View>
      <Animated.View style={[styles.sparkle, styles.sparkleBottomLeft, sparkleStyle]}>
        <Sparkles color="#fff" size={54} strokeWidth={1.5} />
      </Animated.View>

      <View style={[styles.container, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 24) }]}>
        {!celebrationReady ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>{loading ? 'Finishing your connection...' : 'Getting your celebration ready...'}</Text>
          </View>
        ) : (
          <>
            <View style={styles.avatarsStage}>
              <Animated.View style={[styles.avatarFrame, styles.avatarFrameLeft, leftAvatarStyle]}>
                <UserAvatar
                  avatarUrl={firstUser?.avatar_url}
                  name={firstUser?.display_name}
                  size={136}
                  style={styles.avatar}
                />
              </Animated.View>
              <Animated.View style={[styles.avatarFrame, styles.avatarFrameRight, rightAvatarStyle]}>
                <UserAvatar
                  avatarUrl={secondUser?.avatar_url}
                  name={secondUser?.display_name}
                  size={136}
                  style={styles.avatar}
                />
              </Animated.View>
            </View>

            <Animated.View style={[styles.copyBlock, textStyle]}>
              <Text style={styles.eyebrow}>New Connection</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>You can start planning together right away.</Text>
            </Animated.View>

            <Animated.View style={[styles.ctaWrap, buttonStyle]}>
              <Pressable
                accessibilityHint="Opens your connections list."
                accessibilityLabel="See Connections"
                accessibilityRole="button"
                onPress={() => router.replace('/manage-connections')}
                style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
              >
                <Text style={styles.ctaButtonText}>See Connections</Text>
              </Pressable>
            </Animated.View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FF9500',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF9500',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 18,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  sparkle: {
    position: 'absolute',
  },
  sparkleTopRight: {
    top: 96,
    right: 46,
  },
  sparkleTopLeft: {
    top: 172,
    left: 44,
  },
  sparkleBottomLeft: {
    bottom: 138,
    left: 32,
  },
  avatarsStage: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 72,
  },
  avatarFrame: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 6,
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C95D00',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  avatarFrameLeft: {
    marginRight: 82,
  },
  avatarFrameRight: {
    marginLeft: 82,
  },
  avatar: {
    borderWidth: 4,
    borderColor: '#fff',
  },
  copyBlock: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 16,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.82)',
  },
  title: {
    marginTop: 12,
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.7,
    maxWidth: 320,
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    maxWidth: 290,
  },
  ctaWrap: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 8,
  },
  ctaButton: {
    minHeight: 52,
    minWidth: 220,
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A34700',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  ctaButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D96A00',
    letterSpacing: 0.2,
  },
});
