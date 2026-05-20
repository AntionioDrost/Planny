import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Switch, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/utils/supabase';
import { router } from 'expo-router';
import { UserPlus, Settings, LogOut, ShieldAlert, Bell, Calendar as CalendarIcon, ChevronRight, Users } from 'lucide-react-native';
import { UserAvatar } from '@/components/user-avatar';
import { signOut } from '@/services/auth-service';
import { getMyPreferences, setHideEverything, setPushNotificationsEnabled } from '@/services/preferences-service';
import { requestAccountDeletion } from '@/services/profile-service';
import { getLocalCalendarSettings } from '@/services/device-calendar-service';
import { enablePushNotifications, syncExistingPushRegistration } from '@/services/push-service';

export default function UserScreen() {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [pushEnabled, setPushEnabled] = useState(true);
    const [hideEverythingEnabled, setHideEverythingEnabled] = useState(false);
    const [selectedCalendarCount, setSelectedCalendarCount] = useState(0);

    const loadProfile = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                setProfile(null);
                return;
            }

            const fallbackProfile = {
                display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Your Profile',
                email: user.email,
                avatar_url: user.user_metadata?.avatar_url ?? null,
            };

            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.id)
                    .maybeSingle();

                if (error || !data) {
                    setProfile(fallbackProfile);
                } else {
                    setProfile(data);
                }
            } catch {
                setProfile(fallbackProfile);
            }

            try {
                const preferences = await getMyPreferences();
                setHideEverythingEnabled(preferences?.hide_everything_enabled ?? false);
                setPushEnabled(preferences?.push_notifications_enabled ?? true);

                if (preferences?.push_notifications_enabled) {
                    void syncExistingPushRegistration();
                }
            } catch {
                setHideEverythingEnabled(false);
                setPushEnabled(true);
            }

            try {
                const localCalendarSettings = await getLocalCalendarSettings();
                setSelectedCalendarCount(localCalendarSettings.selectedCalendarIds.length);
            } catch {
                setSelectedCalendarCount(0);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadProfile();
        }, [loadProfile])
    );

    const handleLogout = async () => {
        const { error } = await signOut();
        if (error) {
            Alert.alert('Logout warning', error.message);
        }
        router.replace('/');
    };

    const handleToggleHideEverything = async (enabled: boolean) => {
        setHideEverythingEnabled(enabled);
        try {
            await setHideEverything(enabled);
        } catch {
            setHideEverythingEnabled(!enabled);
            Alert.alert('Update failed', 'Could not update privacy shield setting.');
        }
    };

    const handleTogglePush = async (enabled: boolean) => {
        setPushEnabled(enabled);
        try {
            if (enabled) {
                const result = await enablePushNotifications();
                if (!result.supported) {
                    throw new Error(result.reason);
                }
            }
            await setPushNotificationsEnabled(enabled);
        } catch (error: any) {
            setPushEnabled(!enabled);
            Alert.alert('Update failed', error?.message ?? 'Could not update push notification preference.');
        }
    };

    const handleDeleteAccount = async () => {
        Alert.alert(
            'Request Account Deletion',
            'This will request account deletion and sign you out.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Request Deletion',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await requestAccountDeletion();
                            Alert.alert('Deletion requested', 'Your account deletion request was submitted.');
                        } catch (error: any) {
                            Alert.alert('Request failed', error?.message ?? 'Could not request account deletion.');
                        }
                    },
                },
            ]
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color="#FF9500" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.header}>
                <View style={styles.profileInfo}>
                    <UserAvatar
                        avatarUrl={profile?.avatar_url}
                        name={profile?.display_name}
                        size={56}
                        style={styles.avatarPlaceholder}
                    />
                    <View>
                        <Text style={styles.title}>{profile?.display_name || 'Your Profile'}</Text>
                        <Text style={styles.subtitle}>{profile?.email}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/profile-settings' as any)}>
                    <Settings color="#111" size={24} />
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Connections</Text>

                <TouchableOpacity
                    style={styles.addConnectionButton}
                    onPress={() => router.push('/connect' as any)}
                >
                    <UserPlus color="#fff" size={24} style={{ marginRight: 12 }} />
                    <Text style={styles.addConnectionText}>Add new connection</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/manage-connections' as any)}>
                    <View style={styles.actionRowLeft}>
                        <Users color="#666" size={20} />
                        <Text style={styles.actionText}>Manage Connections</Text>
                    </View>
                    <ChevronRight color="#CCC" size={20} />
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Settings & Privacy</Text>

                <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/privacy-settings' as any)}>
                    <View style={styles.actionRowLeft}>
                        <ShieldAlert color="#666" size={20} />
                        <Text style={styles.actionText}>Privacy Defaults & Sleep Hours</Text>
                    </View>
                    <ChevronRight color="#CCC" size={20} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/calendar-settings' as any)}>
                    <View style={styles.actionRowLeft}>
                        <CalendarIcon color="#666" size={20} />
                        <Text style={styles.actionText}>Connected Calendars</Text>
                    </View>
                    <View style={styles.badgePlaceholder}><Text style={styles.badgeTextSmall}>{selectedCalendarCount} Selected</Text></View>
                    <ChevronRight color="#CCC" size={20} />
                </TouchableOpacity>

                <View style={styles.switchRow}>
                    <View style={styles.actionRowLeft}>
                        <Bell color="#666" size={20} />
                        <Text style={styles.actionText}>Push Notifications</Text>
                    </View>
                    <Switch
                        value={pushEnabled}
                        onValueChange={handleTogglePush}
                        trackColor={{ false: '#EAEAEA', true: '#FF9500' }}
                    />
                </View>

                <View style={styles.switchRow}>
                    <View style={styles.actionRowLeft}>
                        <ShieldAlert color="#666" size={20} />
                        <Text style={styles.actionText}>Hide Everything Temporarily</Text>
                    </View>
                    <Switch
                        value={hideEverythingEnabled}
                        onValueChange={handleToggleHideEverything}
                        trackColor={{ false: '#EAEAEA', true: '#FF9500' }}
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account</Text>

                <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/proposals' as any)}>
                    <View style={styles.actionRowLeft}>
                        <CalendarIcon color="#666" size={20} />
                        <Text style={styles.actionText}>Proposal Inbox</Text>
                    </View>
                    <ChevronRight color="#CCC" size={20} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
                    <View style={styles.actionRowLeft}>
                        <LogOut color="#D32F2F" size={20} />
                        <Text style={[styles.actionText, { color: '#D32F2F' }]}>Log Out</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 0 }]} onPress={handleDeleteAccount}>
                    <View style={styles.actionRowLeft}>
                        <Text style={[styles.actionText, { color: '#999', marginLeft: 0 }]}>Delete Account</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9F9F9',
    },
    content: {
        paddingTop: 60,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 40,
    },
    profileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarPlaceholder: {
        marginRight: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111',
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    settingsButton: {
        padding: 8,
        backgroundColor: '#EAEAEA',
        borderRadius: 50,
    },
    section: {
        paddingHorizontal: 24,
        marginBottom: 32,
        backgroundColor: '#fff',
        paddingVertical: 16,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#F0F0F0',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16,
        marginLeft: 8,
    },
    addConnectionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF9500',
        padding: 16,
        borderRadius: 12,
        marginBottom: 24,
        shadowColor: '#FF9500',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    addConnectionText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    actionRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionText: {
        fontSize: 16,
        color: '#333',
        marginLeft: 16,
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    badgePlaceholder: {
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 8,
    },
    badgeTextSmall: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
    }
});
