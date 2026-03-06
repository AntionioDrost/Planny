import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { confirmHandshake, getHandshake } from '@/services/connection-service';

export default function HandshakeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [handshake, setHandshake] = useState<any>(null);

  const handshakeId = useMemo(() => (typeof id === 'string' ? id : ''), [id]);

  const loadHandshake = useCallback(async () => {
    if (!handshakeId) return;

    try {
      const data = await getHandshake(handshakeId);
      setHandshake(data);
    } catch (error: any) {
      Alert.alert('Handshake error', error?.message ?? 'Could not load handshake.');
    } finally {
      setLoading(false);
    }
  }, [handshakeId]);

  useEffect(() => {
    void loadHandshake();

    const interval = setInterval(() => {
      void loadHandshake();
    }, 4000);

    return () => clearInterval(interval);
  }, [loadHandshake]);

  const handleConfirm = async () => {
    if (!handshakeId) return;

    setConfirming(true);
    try {
      const result = await confirmHandshake(handshakeId);
      if (result.status === 'connected') {
        Alert.alert('Connected', 'Connection confirmed by both users.', [
          { text: 'Done', onPress: () => router.replace('/manage-connections') },
        ]);
      } else {
        Alert.alert('Confirmed', 'Your confirmation is saved. Waiting for the other person.');
      }
      await loadHandshake();
    } catch (error: any) {
      Alert.alert('Confirm failed', error?.message ?? 'Could not confirm handshake.');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#FF9500" />
      </View>
    );
  }

  const bothScanned = Boolean(handshake?.scan_1_at && handshake?.scan_2_at);
  const isConnected = handshake?.status === 'connected';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mutual Confirmation</Text>
      <Text style={styles.subtitle}>Both scans and both confirmations are required.</Text>

      <View style={styles.card}>
        <Text style={styles.row}>Scan status: {bothScanned ? 'Both scanned' : 'Waiting for both scans'}</Text>
        <Text style={styles.row}>Handshake status: {handshake?.status ?? 'pending'}</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, (confirming || isConnected || !bothScanned) && styles.buttonDisabled]}
        disabled={confirming || isConnected || !bothScanned}
        onPress={handleConfirm}
      >
        {confirming ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isConnected ? 'Connected' : 'Confirm connection'}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    marginTop: 24,
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    marginTop: 8,
    color: '#666',
    fontSize: 15,
  },
  card: {
    marginTop: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    padding: 16,
    backgroundColor: '#FAFAFA',
    gap: 8,
  },
  row: {
    color: '#333',
    fontSize: 15,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#FF9500',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
