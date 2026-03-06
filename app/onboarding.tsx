import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '@/utils/supabase';
import { router } from 'expo-router';
import { Camera } from 'lucide-react-native';

export default function Onboarding() {
    const [loading, setLoading] = useState(false);
    const [displayName, setDisplayName] = useState('');

    async function handleSaveProfile() {
        if (!displayName.trim()) {
            Alert.alert('Required', 'Please enter a display name.');
            return;
        }

        setLoading(true);

        // In a full implementation, we would upload an avatar to Supabase Storage here.
        // For now, we just update the user's profile with the display name.
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            // First update Auth metadata
            await supabase.auth.updateUser({
                data: { display_name: displayName }
            });

            // Then update public.users table manually if the trigger didn't fire or we need to sync
            const { error } = await supabase
                .from('users')
                .update({ display_name: displayName })
                .eq('id', user.id);

            if (error) {
                Alert.alert('Error', error.message);
            } else {
                router.replace('/(tabs)');
            }
        }

        setLoading(false);
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Set up your profile</Text>
            <Text style={styles.subtitle}>Let connections know who you are.</Text>

            <TouchableOpacity style={styles.avatarContainer}>
                <View style={styles.avatarPlaceholder}>
                    <Camera color="#888" size={32} />
                </View>
                <Text style={styles.avatarText}>Add Profile Picture (Optional)</Text>
            </TouchableOpacity>

            <View style={styles.formContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Display Name (e.g. Alex)"
                    placeholderTextColor="#888"
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                />

                <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleSaveProfile}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.primaryButtonText}>Continue</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={() => router.replace('/(tabs)')}
                >
                    <Text style={styles.skipButtonText}>Skip for now</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 24,
        justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 32,
        lineHeight: 22,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#EAEAEA',
    },
    avatarText: {
        color: '#FF9500',
        fontSize: 14,
        fontWeight: '500',
    },
    formContainer: {
        gap: 16,
    },
    input: {
        backgroundColor: '#F5F5F5',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#EAEAEA',
    },
    primaryButton: {
        backgroundColor: '#FF9500',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    skipButton: {
        padding: 16,
        alignItems: 'center',
    },
    skipButtonText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '500',
    },
});
