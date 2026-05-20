import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { configurePushNotifications } from '@/services/push-service';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    configurePushNotifications();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerBackTitle: 'Back',
          headerBackButtonDisplayMode: 'default',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="connect" options={{ headerShown: false }} />
        <Stack.Screen name="manage-connections" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="propose-time/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="handshake/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="proposals" options={{ headerShown: false }} />
        <Stack.Screen name="proposal/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="privacy-settings" options={{ title: 'Privacy Settings' }} />
        <Stack.Screen name="profile-settings" options={{ title: 'Profile Settings' }} />
        <Stack.Screen name="calendar-settings" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ title: 'Reset Password' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
