import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getProposal, respondEventProposal } from '@/services/event-service';

export default function ProposalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [proposal, setProposal] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const data = await getProposal(id);
        setProposal(data);
      } catch {
        Alert.alert('Error', 'Could not load proposal.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  const handleDecision = async (action: 'accepted' | 'rejected') => {
    if (!id) return;

    setSubmitting(true);
    try {
      await respondEventProposal(id, action);
      Alert.alert('Updated', `Proposal ${action}.`, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Could not update proposal.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !proposal) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color="#FF9500" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{proposal.events?.title ?? 'Event proposal'}</Text>
      <Text style={styles.time}>Start: {new Date(proposal.start_at_utc).toLocaleString()}</Text>
      <Text style={styles.time}>End: {new Date(proposal.end_at_utc).toLocaleString()}</Text>
      <Text style={styles.note}>{proposal.note || 'No note provided.'}</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.button, styles.accept]} onPress={() => handleDecision('accepted')} disabled={submitting}>
          <Text style={styles.acceptText}>Accept Proposal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.reject]} onPress={() => handleDecision('rejected')} disabled={submitting}>
          <Text style={styles.rejectText}>Reject Proposal</Text>
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
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111',
    marginBottom: 14,
  },
  time: {
    color: '#333',
    marginBottom: 8,
  },
  note: {
    marginTop: 8,
    color: '#666',
  },
  actions: {
    marginTop: 24,
    gap: 10,
  },
  button: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  accept: {
    backgroundColor: '#FF9500',
  },
  reject: {
    backgroundColor: '#FFEEED',
    borderWidth: 1,
    borderColor: '#FFD1CE',
  },
  acceptText: {
    color: '#fff',
    fontWeight: '700',
  },
  rejectText: {
    color: '#D32F2F',
    fontWeight: '700',
  },
});
