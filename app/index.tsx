import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '@/utils/supabase';
import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { sendPasswordReset, signInWithEmail, signInWithOAuth, signUpWithEmail } from '@/services/auth-service';

export default function StartPage() {
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const handleSession = async (session: any) => {
            if (session) {
                try {
                    const { data, error } = await supabase
                        .from('users')
                        .select('display_name')
                        .eq('id', session.user.id)
                        .single();

                    if (!error && !data?.display_name) {
                        router.replace('/onboarding');
                    } else {
                        router.replace('/(tabs)');
                    }
                } catch {
                    router.replace('/(tabs)');
                }
            } else {
                if (isMounted) {
                    setInitializing(false);
                }
            }
        };

        supabase.auth.getSession().then(({ data: { session } }: any) => {
            handleSession(session);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
            handleSession(session);
        });

        return () => {
            isMounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    async function handleAuth() {
        setLoading(true);
        if (isSignUp) {
            const { error } = await signUpWithEmail(email, password);
            if (error) Alert.alert('Sign up failed', error.message);
            else Alert.alert('Success', 'Check your email for the verification link.');
        } else {
            const { error } = await signInWithEmail(email, password);
            if (error) Alert.alert('Sign in failed', error.message);
        }
        setLoading(false);
    }

    async function handleResetPassword() {
        if (!email.trim()) {
            Alert.alert('Email required', 'Enter your account email first.');
            return;
        }

        setLoading(true);
        const { error } = await sendPasswordReset(email);
        setLoading(false);

        if (error) {
            Alert.alert('Reset failed', error.message);
            return;
        }

        Alert.alert('Email sent', 'Check your inbox to reset your password.');
    }

    async function handleOAuth(provider: 'google' | 'apple') {
        setLoading(true);
        const { error } = await signInWithOAuth(provider);
        setLoading(false);

        if (error) {
            Alert.alert('Login failed', error.message);
        }
    }

    if (initializing) {
        return (
            <View style={styles.splashContainer}>
                <View style={styles.sparklesContainer}>
                    <Sparkles color="#fff" size={80} strokeWidth={1} style={{ position: 'absolute', top: -40, right: 30 }} />
                    <Sparkles color="#fff" size={50} strokeWidth={1.5} style={{ position: 'absolute', bottom: -10, left: 10 }} />
                </View>
                <Text style={styles.splashTitle}>Planny</Text>
                <ActivityIndicator size="small" color="#fff" style={{ marginTop: 20 }} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.heroArea}>
                <Sparkles color="#fff" size={72} strokeWidth={1.5} style={{ position: 'absolute', top: 80, right: 80 }} />
                <Sparkles color="#fff" size={44} strokeWidth={1.8} style={{ position: 'absolute', top: 190, left: 80 }} />
                <Text style={styles.brandTitle}>Planny</Text>
                <Text style={styles.brandSubtitle}>Coordinate dates, manage privacy, and share plans.</Text>
            </View>

            <View style={styles.formCard}>
                <View style={styles.formContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email address"
                        placeholderTextColor="#888"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#888"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleAuth}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.primaryButtonText}>{isSignUp ? 'Create Account' : 'Log In'}</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => setIsSignUp(!isSignUp)}
                    >
                        <Text style={styles.secondaryButtonText}>
                            {isSignUp ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.resetButton} onPress={handleResetPassword}>
                        <Text style={styles.resetText}>Forgot password?</Text>
                    </TouchableOpacity>

                    <View style={styles.oauthContainer}>
                        <TouchableOpacity style={styles.oauthButton} disabled={loading} onPress={() => handleOAuth('apple')}>
                            <Text style={styles.oauthText}>Continue with Apple</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.oauthButton} disabled={loading} onPress={() => handleOAuth('google')}>
                            <Text style={styles.oauthText}>Continue with Google</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    splashContainer: {
        flex: 1,
        backgroundColor: '#FF9500',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sparklesContainer: {
        width: 200,
        height: 150,
        position: 'relative',
        marginBottom: 40,
    },
    splashTitle: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: -1,
    },
    container: {
        flex: 1,
        backgroundColor: '#FF9500',
    },
    heroArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    brandTitle: {
        fontSize: 56,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: -1,
        marginBottom: 8,
    },
    brandSubtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 15,
        textAlign: 'center',
        maxWidth: 320,
        lineHeight: 22,
    },
    formCard: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 8,
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
    secondaryButton: {
        padding: 16,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#FF9500',
        fontSize: 14,
        fontWeight: '500',
    },
    resetButton: {
        alignItems: 'center',
        marginTop: -8,
        marginBottom: 4,
    },
    resetText: {
        color: '#666',
        fontSize: 13,
    },
    oauthContainer: {
        gap: 10,
        marginTop: 6,
    },
    oauthButton: {
        borderWidth: 1,
        borderColor: '#EAEAEA',
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
    },
    oauthText: {
        color: '#222',
        fontSize: 14,
        fontWeight: '600',
    },
});
