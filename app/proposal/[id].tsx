import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEventForSync, getProposal, respondEventProposal } from '@/services/event-service';
import { syncPlannyEventToDeviceCalendars } from '@/services/device-calendar-service';
import { supabase } from '@/utils/supabase';

export default function ProposalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const { data: authData } = await supabase.auth.getUser();
        setMyUserId(authData.user?.id ?? null);
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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/proposals' as any);
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
      <TouchableOpacity
        accessibilityLabel="Go back"
        accessibilityRole="button"
        hitSlop={12}
        onPress={handleBack}
        style={styles.backButton}
      >
        <ArrowLeft size={24} color="#111" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Proposal</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  const handleDecision = async (action: 'accepted' | 'rejected') => {
    if (!id) return;

    setSubmitting(true);
    try {
      await respondEventProposal(id, action);
      let syncMessage = '';
      if (action === 'accepted' && proposal?.event_id) {
        try {
          const syncableEvent = await getEventForSync(proposal.event_id);
          const syncResult = await syncPlannyEventToDeviceCalendars(syncableEvent);
          const syncedCalendarCount = 'syncedCalendars' in syncResult ? syncResult.syncedCalendars ?? 0 : 0;
          if (!syncResult.skipped && syncedCalendarCount > 0) {
            syncMessage = ` Synced to ${syncedCalendarCount} device calendar${syncedCalendarCount === 1 ? '' : 's'}.`;
          }
        } catch (syncError: any) {
          syncMessage = ` Calendar sync failed: ${syncError?.message ?? 'unknown error'}.`;
        }
      }

      Alert.alert('Updated', `Proposal ${action}.${syncMessage}`, [{ text: 'OK', onPress: handleBack }]);
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Could not update proposal.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !proposal) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingState}>
          <ActivityIndicator color="#FF9500" />
        </View>
      </View>
    );
  }

  const isCreatorView = proposal.events?.creator_id === myUserId;

  return (
    <View style={styles.container}>
      {renderHeader()}
      <Text style={styles.title}>{proposal.events?.title ?? 'Event proposal'}</Text>
      <Text style={styles.time}>Start: {new Date(proposal.start_at_utc).toLocaleString()}</Text>
      <Text style={styles.time}>End: {new Date(proposal.end_at_utc).toLocaleString()}</Text>
      <Text style={styles.note}>{proposal.note || 'No note provided.'}</Text>

      {isCreatorView ? (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, styles.accept]} onPress={() => handleDecision('accepted')} disabled={submitting}>
            <Text style={styles.acceptText}>Accept Proposal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.reject]} onPress={() => handleDecision('rejected')} disabled={submitting}>
            <Text style={styles.rejectText}>Reject Proposal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Proposal sent</Text>
          <Text style={styles.infoCardText}>
            The event creator can review this proposal in their inbox and decide whether to accept it.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: -8,
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
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
  infoCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#A35A00',
    marginBottom: 6,
  },
  infoCardText: {
    color: '#8A6A3E',
    lineHeight: 20,
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
