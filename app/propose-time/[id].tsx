import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Calendar as CalendarIcon, Clock, PenTool } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/utils/supabase';
import { getEventForSync, proposeEventTime, rescheduleEventAsCreator } from '@/services/event-service';
import { syncPlannyEventToDeviceCalendars } from '@/services/device-calendar-service';

export default function ProposeTimeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [eventTitle, setEventTitle] = useState('Event');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [isAllDay, setIsAllDay] = useState(false);
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date(new Date().setHours(new Date().getHours() + 1)));
  const [note, setNote] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        Alert.alert('Missing event', 'Could not open the proposal form.');
        router.back();
        return;
      }

      try {
        const { data: authData } = await supabase.auth.getUser();
        const currentUserId = authData.user?.id ?? null;
        const { data, error } = await supabase
          .from('events')
          .select('id, creator_id, title, start_at_utc, end_at_utc, timezone, is_all_day')
          .eq('id', id)
          .single();

        if (error || !data) {
          throw error ?? new Error('Event not found');
        }

        const initialStart = new Date(data.start_at_utc);
        const initialEnd = new Date(data.end_at_utc);

        setEventTitle(data.title ?? 'Event');
        setTimezone(data.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
        setIsAllDay(Boolean(data.is_all_day));
        setDate(initialStart);
        setStartTime(initialStart);
        setEndTime(initialEnd);
        setIsCreator(Boolean(currentUserId && data.creator_id === currentUserId));

        if (currentUserId && data.creator_id === currentUserId) {
          const { count } = await supabase
            .from('event_participants')
            .select('user_id', { count: 'exact', head: true })
            .eq('event_id', id);

          setParticipantCount(count ?? 0);
        }
      } catch (error: any) {
        Alert.alert('Could not load event', error?.message ?? 'Please try again.');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  const screenTitle = useMemo(
    () => `${isCreator ? 'Suggest a new time for' : 'Propose a new time for'} ${eventTitle}`,
    [eventTitle, isCreator]
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/proposals' as any);
  };

  const submitProposal = async () => {
    if (!id) {
      Alert.alert('Missing event', 'Could not submit a proposal for this event.');
      return;
    }

    const proposedStart = new Date(date);
    const proposedEnd = new Date(date);

    if (isAllDay) {
      proposedStart.setHours(0, 0, 0, 0);
      proposedEnd.setDate(proposedEnd.getDate() + 1);
      proposedEnd.setHours(0, 0, 0, 0);
    } else {
      proposedStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
      proposedEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
    }

    if (proposedEnd <= proposedStart) {
      Alert.alert('Invalid time', 'End time must be after start time.');
      return;
    }

    if (isCreator && participantCount === 0) {
      Alert.alert('Invite someone first', 'Add at least one participant before proposing a time change.');
      return;
    }

    setSubmitting(true);
    try {
      if (isCreator) {
        await rescheduleEventAsCreator(
          id,
          proposedStart.toISOString(),
          proposedEnd.toISOString(),
          timezone
        );

        let syncMessage = '';
        try {
          const syncableEvent = await getEventForSync(id);
          const syncResult = await syncPlannyEventToDeviceCalendars(syncableEvent);
          const syncedCalendarCount = 'syncedCalendars' in syncResult ? syncResult.syncedCalendars ?? 0 : 0;
          if (!syncResult.skipped && syncedCalendarCount > 0) {
            syncMessage = ` Synced to ${syncedCalendarCount} device calendar${syncedCalendarCount === 1 ? '' : 's'}.`;
          }
        } catch (syncError: any) {
          syncMessage = ` Calendar sync failed: ${syncError?.message ?? 'unknown error'}.`;
        }

        Alert.alert(
          'Time change sent',
          `The event was updated and participants need to respond again.${syncMessage}`,
          [{ text: 'OK', onPress: () => router.replace(`/event/${id}` as any) }]
        );
      } else {
        await proposeEventTime(
          id,
          proposedStart.toISOString(),
          proposedEnd.toISOString(),
          timezone,
          note.trim() || 'Proposed from the app'
        );

        Alert.alert('Proposal sent', 'Your new time has been sent to the event creator.', [
          { text: 'OK', onPress: () => router.replace('/proposals' as any) },
        ]);
      }
    } catch (error: any) {
      Alert.alert(
        isCreator ? 'Time change failed' : 'Proposal failed',
        error?.message ?? (isCreator ? 'Could not update this event.' : 'Could not submit your proposed time.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} color="#111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Propose Time</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingState}>
          <ActivityIndicator color="#FF9500" />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Propose Time</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.title}>{screenTitle}</Text>
      <Text style={styles.subtitle}>
        {isCreator
          ? 'Choose a new date or time for this event. Invitees will be asked to respond again.'
          : 'Choose a new date or time to suggest to the event creator.'}
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <CalendarIcon size={20} color="#666" />
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.pickerButton}>
            <Text style={styles.pickerText}>{date.toLocaleDateString()}</Text>
          </TouchableOpacity>
        </View>

        {showDatePicker ? (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={(_event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setDate(selectedDate);
            }}
          />
        ) : null}

        {!isAllDay ? (
          <>
            <View style={styles.row}>
              <Clock size={20} color="#666" />
              <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.pickerButton}>
                <Text style={styles.pickerText}>
                  Starts: {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>

            {showStartPicker ? (
              <DateTimePicker
                value={startTime}
                mode="time"
                display="default"
                onChange={(_event, selectedTime) => {
                  setShowStartPicker(false);
                  if (selectedTime) setStartTime(selectedTime);
                }}
              />
            ) : null}

            <View style={styles.row}>
              <Clock size={20} color="#666" />
              <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.pickerButton}>
                <Text style={styles.pickerText}>
                  Ends: {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>

            {showEndPicker ? (
              <DateTimePicker
                value={endTime}
                mode="time"
                display="default"
                onChange={(_event, selectedTime) => {
                  setShowEndPicker(false);
                  if (selectedTime) setEndTime(selectedTime);
                }}
              />
            ) : null}
          </>
        ) : (
          <Text style={styles.helperText}>This event is all day, so only the proposed date needs to change.</Text>
        )}

        {!isCreator ? (
          <View style={styles.noteBlock}>
            <View style={styles.noteLabelRow}>
              <PenTool size={16} color="#666" />
              <Text style={styles.noteLabel}>Note for the creator</Text>
            </View>
            <TextInput
              multiline
              placeholder="Add a short explanation, like why this time works better."
              placeholderTextColor="#888"
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
            />
          </View>
        ) : null}
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={submitProposal} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>{isCreator ? 'Update Date' : 'Send Proposal'}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EAEAEA',
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
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  pickerButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    flex: 1,
  },
  pickerText: {
    color: '#333',
    fontSize: 16,
  },
  helperText: {
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  noteBlock: {
    marginTop: 10,
  },
  noteLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  noteLabel: {
    marginLeft: 8,
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  noteInput: {
    minHeight: 110,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    textAlignVertical: 'top',
    fontSize: 15,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#FF9500',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
