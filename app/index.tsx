import React, { useState, useEffect } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { isSupabaseConfigured, supabase } from '@/utils/supabase';
import { checkSupabaseReachability } from '@/utils/supabase-health';
import { router } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { sendPasswordReset, signInWithEmail, signInWithOAuth, signUpWithEmail } from '@/services/auth-service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StartPage() {
    const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [backendMessage, setBackendMessage] = useState<string | null>(null);
    const insets = useSafeAreaInsets();
    const { height, width } = useWindowDimensions();
    const isCompactHeight = height < 760;
    const isVeryCompactHeight = height < 680;
    const brandTitleSize = Math.round(Math.min(56, Math.max(44, width * 0.14)));
    const heroMinHeight = Math.round(
        isVeryCompactHeight ? 236 : isCompactHeight ? 278 : Math.min(352, height * 0.42)
    );

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
        }).catch((error: any) => {
            if (isMounted) {
                setBackendMessage(error?.message ?? 'Could not initialize the Supabase session.');
                setInitializing(false);
            }
        });

        checkSupabaseReachability().then((result) => {
            if (isMounted) {
                setBackendMessage(result.message);
            }
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
            <View style={[styles.splashContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardContainer}
            >
                <ScrollView
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.scrollContent}
                >
                    <View
                        style={[
                            styles.heroArea,
                            {
                                minHeight: heroMinHeight,
                                paddingTop: Math.max(insets.top + 20, 36),
                                paddingBottom: isVeryCompactHeight ? 26 : 42,
                            },
                        ]}
                    >
                        <Sparkles
                            color="#fff"
                            size={isCompactHeight ? 54 : 68}
                            strokeWidth={1.45}
                            style={[styles.sparkle, styles.sparklePrimary]}
                        />
                        <Sparkles
                            color="#fff"
                            size={isCompactHeight ? 28 : 34}
                            strokeWidth={1.8}
                            style={[styles.sparkle, styles.sparkleSecondary]}
                        />
                        <View style={styles.brandLockup}>
                            <Text style={[styles.brandTitle, { fontSize: brandTitleSize }]}>Planny</Text>
                            <Text style={styles.brandSubtitle}>Coordinate dates, manage privacy, and share plans.</Text>
                        </View>
                    </View>

                    <View style={[styles.formCard, { paddingBottom: Math.max(insets.bottom + 24, 32) }]}>
                        <View style={styles.formContainer}>
                            {!isSupabaseConfigured && (
                                <View style={styles.configBanner}>
                                    <Text style={styles.configBannerText}>
                                        Backend not configured. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` before signing in.
                                    </Text>
                                </View>
                            )}
                            {isSupabaseConfigured && backendMessage && (
                                <View style={styles.configBanner}>
                                    <Text style={styles.configBannerText}>{backendMessage}</Text>
                                </View>
                            )}
                            <TextInput
                                style={styles.input}
                                placeholder="Email address"
                                placeholderTextColor="#888"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                textContentType="emailAddress"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor="#888"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                textContentType="password"
                            />

                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={handleAuth}
                                disabled={loading || !isSupabaseConfigured}
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
                                disabled={!isSupabaseConfigured}
                            >
                                <Text style={styles.secondaryButtonText}>
                                    {isSignUp ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.resetButton} onPress={handleResetPassword} disabled={!isSupabaseConfigured}>
                                <Text style={styles.resetText}>Forgot password?</Text>
                            </TouchableOpacity>

                            <View style={styles.oauthContainer}>
                                <TouchableOpacity style={styles.oauthButton} disabled={loading || !isSupabaseConfigured} onPress={() => handleOAuth('apple')}>
                                    <Text style={styles.oauthText}>Continue with Apple</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.oauthButton} disabled={loading || !isSupabaseConfigured} onPress={() => handleOAuth('google')}>
                                    <Text style={styles.oauthText}>Continue with Google</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
        letterSpacing: 0,
    },
    container: {
        flex: 1,
        backgroundColor: '#FF9500',
    },
    keyboardContainer: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'flex-end',
    },
    heroArea: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        position: 'relative',
        overflow: 'hidden',
    },
    sparkle: {
        position: 'absolute',
        opacity: 0.92,
    },
    sparklePrimary: {
        top: 56,
        right: 58,
    },
    sparkleSecondary: {
        top: 116,
        left: 48,
        opacity: 0.64,
    },
    brandLockup: {
        alignItems: 'center',
        zIndex: 1,
        width: '100%',
    },
    brandTitle: {
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 0,
        marginBottom: 10,
    },
    brandSubtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 15,
        textAlign: 'center',
        maxWidth: 340,
        lineHeight: 22,
    },
    formCard: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 24,
        paddingTop: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 8,
    },
    formContainer: {
        gap: 16,
    },
    configBanner: {
        borderRadius: 12,
        backgroundColor: '#FFF4E5',
        borderWidth: 1,
        borderColor: '#FFD59A',
        padding: 12,
    },
    configBannerText: {
        color: '#8A5A00',
        fontSize: 13,
        lineHeight: 18,
    },
    input: {
        backgroundColor: '#F5F5F5',
        minHeight: 58,
        paddingHorizontal: 16,
        paddingVertical: 15,
        borderRadius: 12,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#EAEAEA',
    },
    primaryButton: {
        backgroundColor: '#FF9500',
        minHeight: 58,
        paddingHorizontal: 16,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        minHeight: 48,
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
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
        minHeight: 54,
        paddingHorizontal: 14,
        paddingVertical: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAFAFA',
    },
    oauthText: {
        color: '#222',
        fontSize: 14,
        fontWeight: '600',
    },
});
