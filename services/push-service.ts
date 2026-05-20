import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { registerDevicePushToken } from '@/services/notification-service';

let notificationsConfigured = false;
let notificationsModule: typeof import('expo-notifications') | null = null;

function isAndroidExpoGo() {
  return Platform.OS === 'android' && Constants.appOwnership === 'expo';
}

function getNotifications() {
  if (!notificationsModule) {
    notificationsModule = require('expo-notifications');
  }

  return notificationsModule as typeof import('expo-notifications');
}

export function configurePushNotifications() {
  if (notificationsConfigured) {
    return;
  }

  if (isAndroidExpoGo()) {
    return;
  }

  const Notifications = getNotifications();

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  notificationsConfigured = true;
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  const Notifications = getNotifications();

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

function getProjectId() {
  const expoConfigProjectId = (Constants.expoConfig as any)?.extra?.eas?.projectId;
  return Constants.easConfig?.projectId ?? expoConfigProjectId ?? undefined;
}

type PushRegistrationResult =
  | { supported: true; token: string }
  | { supported: false; reason: string };

async function registerTokenWithExpo() {
  const Notifications = getNotifications();
  const projectId = getProjectId();
  const response = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  return response.data;
}

export async function syncExistingPushRegistration(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { supported: false, reason: 'Push notifications are not supported on web.' };
  }

  if (isAndroidExpoGo()) {
    return {
      supported: false,
      reason: 'Android push notifications require a development build.',
    };
  }

  if (!Device.isDevice) {
    return {
      supported: false,
      reason: 'Push notifications require a physical device or development build.',
    };
  }

  await ensureAndroidNotificationChannel();

  const Notifications = getNotifications();
  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) {
    return { supported: false, reason: 'Notification permission has not been granted yet.' };
  }

  const token = await registerTokenWithExpo();
  await registerDevicePushToken(token, Platform.OS as 'ios' | 'android');
  return { supported: true, token };
}

export async function enablePushNotifications(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { supported: false, reason: 'Push notifications are not supported on web.' };
  }

  if (isAndroidExpoGo()) {
    return {
      supported: false,
      reason: 'Android push notifications require a development build.',
    };
  }

  if (!Device.isDevice) {
    return {
      supported: false,
      reason: 'Push notifications require a physical device or development build.',
    };
  }

  await ensureAndroidNotificationChannel();

  const Notifications = getNotifications();
  const currentPermissions = await Notifications.getPermissionsAsync();
  const permissions = currentPermissions.granted
    ? currentPermissions
    : await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });

  if (!permissions.granted) {
    return { supported: false, reason: 'Notification permission was not granted.' };
  }

  const token = await registerTokenWithExpo();
  await registerDevicePushToken(token, Platform.OS as 'ios' | 'android');
  return { supported: true, token };
}
