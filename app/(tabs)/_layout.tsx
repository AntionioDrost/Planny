import { Tabs, router } from 'expo-router';
import React, { useEffect } from 'react';
import { Calendar, PlusCircle, User } from 'lucide-react-native';
import { Platform } from 'react-native';
import { HapticTab } from '@/components/haptic-tab';
import { supabase } from '@/utils/supabase';

export default function TabLayout() {
  const themeTint = '#FF9500'; // Planny Orange

  useEffect(() => {
    let mounted = true;

    const ensureAuthenticated = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted && !data.session) {
        router.replace('/');
      }
    };

    void ensureAuthenticated();

    const { data: listener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (!session) {
        router.replace('/');
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: themeTint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute', // transparent blur background on iOS
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Calendar size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="planning"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color }) => <PlusCircle size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="user"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
