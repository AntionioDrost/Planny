import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/utils/supabase';
import { normalizeSupabaseError } from '@/utils/supabase-health';

function readUrlParams(url: string) {
  const params = new URLSearchParams();
  const [, queryAndHash = ''] = url.split('?');
  const [query = '', hashFromQuery = ''] = queryAndHash.split('#');
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : hashFromQuery;

  for (const part of [query, hash]) {
    if (!part) continue;
    const parsed = new URLSearchParams(part);
    parsed.forEach((value, key) => params.set(key, value));
  }

  return params;
}

export default function ResetPasswordScreen() {
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('Opening your secure reset link...');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const prepareRecoverySession = useCallback(async (url: string | null) => {
    setPreparing(true);
    setRecoveryMessage('Opening your secure reset link...');

    try {
      if (url) {
        const params = readUrlParams(url);
        const errorDescription = params.get('error_description') ?? params.get('error');
        if (errorDescription) {
          throw new Error(errorDescription.replace(/\+/g, ' '));
        }

        const code = params.get('code');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (!data.session) {
        setRecoveryReady(false);
        setRecoveryMessage('Open the password reset link from your email before choosing a new password.');
        return;
      }

      setRecoveryReady(true);
      setRecoveryMessage('Choose a new password for your account.');
    } catch (error: any) {
      setRecoveryReady(false);
      setRecoveryMessage(normalizeSupabaseError(error).message);
    } finally {
      setPreparing(false);
    }
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then((url) => void prepareRecoverySession(url));

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void prepareRecoverySession(url);
    });

    return () => subscription.remove();
  }, [prepareRecoverySession]);

  const handleUpdatePassword = async () => {
    if (!recoveryReady) {
      Alert.alert('Reset link required', 'Open the password reset link from your email first.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Invalid password', 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Enter the same password twice.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      Alert.alert('Could not update password', error.message);
      return;
    }

    Alert.alert('Password updated', 'You can now log in with your new password.', [
      {
        text: 'OK',
        onPress: async () => {
          await supabase.auth.signOut({ scope: 'local' as any });
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset password</Text>
      <Text style={styles.subtitle}>{recoveryMessage}</Text>

      <TextInput
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="New password"
        placeholderTextColor="#888"
        editable={recoveryReady && !preparing && !loading}
        textContentType="newPassword"
      />

      <TextInput
        style={styles.input}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirm new password"
        placeholderTextColor="#888"
        editable={recoveryReady && !preparing && !loading}
        textContentType="newPassword"
      />

      <TouchableOpacity
        style={[styles.button, (!recoveryReady || preparing) && styles.buttonDisabled]}
        onPress={handleUpdatePassword}
        disabled={loading || preparing}
      >
        {loading || preparing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Password</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#F5F5F5',
  },
  button: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
