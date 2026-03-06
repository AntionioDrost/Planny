import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '@/utils/supabase';
import { Calendar } from 'react-native-calendars';
import { Clock, MapPin } from 'lucide-react-native';
import { router } from 'expo-router';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});
  const initialSelectedDateRef = useRef(new Date().toISOString().split('T')[0]);
  const [selectedDate, setSelectedDate] = useState(initialSelectedDateRef.current);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setLoading(false);
      return;
    }

    // Fetch user's own events (creator) and events they are participating in
    const { data: myEvents } = await supabase
      .from('events')
      .select('*')
      .eq('creator_id', session.user.id);

    const { data: participantEvents } = await supabase
      .from('event_participants')
      .select('events(*)')
      .eq('user_id', session.user.id);

    // Fetch events shared with them for visibility
    const { data: visibleEvents } = await supabase
      .from('event_visibility')
      .select('level, events(*)')
      .eq('viewer_user_id', session.user.id)
      .neq('level', 'hidden');

    // Combine and deduplicate
    const allEventsMap = new Map<string, any>();

    // 1. Own events
    myEvents?.forEach((e: any) => {
      allEventsMap.set(e.id, { ...e, type: 'mine' });
    });

    // 2. Participant events (flatten the join)
    participantEvents?.forEach((pe: any) => {
      if (pe.events && !allEventsMap.has((pe.events as any).id)) {
        allEventsMap.set((pe.events as any).id, { ...(pe.events as any), type: 'participant' });
      }
    });

    // 3. Visible events (apply privacy masking if needed)
    visibleEvents?.forEach((ve: any) => {
      const ev = ve.events as any;
      if (ev && !allEventsMap.has(ev.id)) {
        let maskedEvent = { ...ev, type: 'visible', visibilityLevel: ve.level };

        // Apply privacy filtering locally based on the returned level
        if (ve.level === 'busy_only') {
          maskedEvent.title = 'Busy';
          maskedEvent.location = null;
          maskedEvent.notes = null;
        } else if (ve.level === 'title_only') {
          maskedEvent.location = null;
          maskedEvent.notes = null;
        }

        allEventsMap.set(ev.id, maskedEvent);
      }
    });

    const combinedEvents = Array.from(allEventsMap.values());

    // Process markers for the calendar
    const marks: any = {};
    combinedEvents.forEach(e => {
      if (e.date) {
        if (!marks[e.date]) {
          marks[e.date] = { dots: [] };
        }
        // Add a dot matching the brand orange
        marks[e.date].dots.push({ color: '#FF9500' });
      }
    });

    // Ensure the selected date is highlighted even if it has dots
    const finalMarks = { ...marks };
    const initialSelectedDate = initialSelectedDateRef.current;
    if (finalMarks[initialSelectedDate]) {
      finalMarks[initialSelectedDate] = { ...finalMarks[initialSelectedDate], selected: true, selectedColor: '#FF9500', selectedTextColor: '#fff' };
    } else {
      finalMarks[initialSelectedDate] = { selected: true, selectedColor: '#FF9500', selectedTextColor: '#fff' };
    }

    setEvents(combinedEvents);
    setMarkedDates(finalMarks);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const onDayPress = (day: any) => {
    setSelectedDate(day.dateString);

    // Update marker styling for the new selection
    const newMarks = { ...markedDates };

    // Reset previous selection maintaining its dots
    Object.keys(newMarks).forEach(date => {
      if (newMarks[date].selected) {
        newMarks[date] = { ...newMarks[date], selected: false };
      }
    });

    // Set new selection
    if (newMarks[day.dateString]) {
      newMarks[day.dateString] = { ...newMarks[day.dateString], selected: true, selectedColor: '#FF9500', selectedTextColor: '#fff' };
    } else {
      newMarks[day.dateString] = { selected: true, selectedColor: '#FF9500', selectedTextColor: '#fff' };
    }

    setMarkedDates(newMarks);
  };

  const selectedDateObj = new Date(selectedDate);
  const weekEnd = new Date(selectedDateObj);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const visibleEvents = events.filter((event) => {
    if (!event.date) return false;
    const eventDate = new Date(event.date);
    if (viewMode === 'day') {
      return event.date === selectedDate;
    }
    if (viewMode === 'week') {
      return eventDate >= selectedDateObj && eventDate <= weekEnd;
    }
    return (
      eventDate.getFullYear() === selectedDateObj.getFullYear() &&
      eventDate.getMonth() === selectedDateObj.getMonth()
    );
  }).sort((a, b) => {
    if (a.is_all_day) return -1;
    if (b.is_all_day) return 1;
    if (!a.start_time) return 0;
    if (!b.start_time) return 0;
    return a.start_time.localeCompare(b.start_time);
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Overview</Text>
      </View>

      <Calendar
        current={selectedDate}
        onDayPress={onDayPress}
        markingType={'multi-dot'}
        markedDates={markedDates}
        theme={{
          backgroundColor: '#fff',
          calendarBackground: '#fff',
          textSectionTitleColor: '#111',
          selectedDayBackgroundColor: '#FF9500',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#FF9500',
          dayTextColor: '#333',
          textDisabledColor: '#d9e1e8',
          dotColor: '#FF9500',
          selectedDotColor: '#ffffff',
          arrowColor: '#FF9500',
          monthTextColor: '#111',
          indicatorColor: '#FF9500',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '600',
        }}
        style={styles.calendar}
      />

      <ScrollView style={styles.agendaContainer}>
        <View style={styles.modeRow}>
          {(['day', 'week', 'month'] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.modeButton, viewMode === mode && styles.modeButtonActive]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.modeText, viewMode === mode && styles.modeTextActive]}>
                {mode.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.agendaTitle}>
          {viewMode === 'day'
            ? new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
            : viewMode === 'week'
              ? `Week of ${new Date(selectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
              : new Date(selectedDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>

        {loading ? (
          <ActivityIndicator color="#FF9500" style={{ marginTop: 40 }} />
        ) : visibleEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Nothing planned for this day.</Text>
          </View>
        ) : (
          visibleEvents.map(event => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              onPress={() => router.push(`/event/${event.id}`)}
            >
              <View style={[styles.eventStripe, event.visibilityLevel === 'busy_only' ? styles.stripeBusy : styles.stripeNormal]} />

              <View style={styles.eventContent}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {event.visibilityLevel === 'busy_only' && (
                    <View style={styles.badgeBusy}><Text style={styles.badgeText}>Private</Text></View>
                  )}
                  {event.visibilityLevel === 'title_only' && (
                    <View style={styles.badgeTitle}><Text style={styles.badgeText}>Limited</Text></View>
                  )}
                </View>

                {!event.is_all_day && event.start_time ? (
                  <View style={styles.eventDetailRow}>
                    <Clock size={14} color="#666" />
                    <Text style={styles.eventDetailText}>
                      {event.start_time.substring(0, 5)} {event.end_time ? `- ${event.end_time.substring(0, 5)}` : ''}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.eventDetailRow}>
                    <Clock size={14} color="#666" />
                    <Text style={styles.eventDetailText}>All Day</Text>
                  </View>
                )}

                {event.location && (
                  <View style={styles.eventDetailRow}>
                    <MapPin size={14} color="#666" />
                    <Text style={styles.eventDetailText}>{event.location}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111',
  },
  calendar: {
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  agendaContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  agendaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 16,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  modeButton: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
  },
  modeButtonActive: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  modeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#fff',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  emptyStateText: {
    color: '#888',
    fontSize: 16,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  eventStripe: {
    width: 6,
  },
  stripeNormal: {
    backgroundColor: '#FF9500',
  },
  stripeBusy: {
    backgroundColor: '#CCC',
  },
  eventContent: {
    flex: 1,
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },
  badgeBusy: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTitle: {
    backgroundColor: '#FFF4E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
    textTransform: 'uppercase',
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  eventDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
});
