import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { updateMyDisplayName } from '@/services/profile-service';

export default function Onboarding() {
    const [loading, setLoading] = useState(false);
    const [displayName, setDisplayName] = useState('');

    async function handleSaveProfile() {
        if (!displayName.trim()) {
            Alert.alert('Required', 'Please enter a display name.');
            return;
        }

        setLoading(true);
        try {
            await updateMyDisplayName(displayName.trim());
            router.replace('/(tabs)');
        } catch (error: any) {
            Alert.alert('Error', error?.message ?? 'Could not save your display name.');
        }

        setLoading(false);
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Set up your profile</Text>
            <Text style={styles.subtitle}>Your display name is required before you can continue.</Text>

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
        marginBottom: 28,
        lineHeight: 22,
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
});
