import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/utils/supabase';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Users, Lock, Calendar as CalendarIcon, Clock, MapPin, AlignLeft } from 'lucide-react-native';
import { VISIBILITY_LABELS, VISIBILITY_LEVELS } from '@/constants/visibility';
import { createEventBundle, getEventForSync } from '@/services/event-service';
import { checkAvailability } from '@/utils/availability';
import { listConnections } from '@/services/connection-service';
import { getMyPreferences } from '@/services/preferences-service';
import { syncPlannyEventToDeviceCalendars } from '@/services/device-calendar-service';
import type { VisibilityLevel } from '@/types/domain';

export default function PlanningScreen() {
    const [loading, setLoading] = useState(false);
    const [connectionsLoading, setConnectionsLoading] = useState(true);
    const [connections, setConnections] = useState<any[]>([]);
    const [defaultVisibility, setDefaultVisibility] = useState<VisibilityLevel>('busy_only');

    // Form State
    const [title, setTitle] = useState('');
    const [date, setDate] = useState(new Date());
    const [startTime, setStartTime] = useState(new Date());
    const [endTime, setEndTime] = useState(new Date(new Date().setHours(new Date().getHours() + 1))); // Default 1 hr
    const [isAllDay, setIsAllDay] = useState(false);
    const [location, setLocation] = useState('');
    const [notes, setNotes] = useState('');

    // Participants & Visibility
    const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
    const [visibilitySettings, setVisibilitySettings] = useState<Record<string, VisibilityLevel>>({});

    // Date Pickers State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);

    const loadConnections = useCallback(async () => {
        setConnectionsLoading(true);
        try {
            const connectionProfiles = await listConnections();
            let nextDefaultVisibility: VisibilityLevel = 'busy_only';

            try {
                const preferences = await getMyPreferences();
                nextDefaultVisibility = preferences?.default_existing_visibility ?? 'busy_only';
            } catch {
                // Fall back to the product default so the planner still works if preferences are unavailable.
            }

            const availableUserIds = new Set<string>();
            connectionProfiles.forEach((connection: any) => {
                const otherUserId = connection.otherUser?.id;
                if (otherUserId) {
                    availableUserIds.add(otherUserId);
                }
            });

            setConnections(connectionProfiles);
            setDefaultVisibility(nextDefaultVisibility);
            setSelectedParticipants((prev) => prev.filter((userId) => availableUserIds.has(userId)));
            setVisibilitySettings((prev) => {
                const next: Record<string, VisibilityLevel> = {};

                availableUserIds.forEach((userId) => {
                    next[userId] = prev[userId] ?? nextDefaultVisibility;
                });

                return next;
            });
        } catch (error: any) {
            setConnections([]);
            Alert.alert('Could not load planner', error?.message ?? 'Connections could not be loaded.');
        } finally {
            setConnectionsLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadConnections();
        }, [loadConnections])
    );

    const availableConnections = connections.filter((connection) => connection.otherUser?.id);
    const allParticipantIds = availableConnections.map((connection) => connection.otherUser.id);
    const allConnectionsSelected =
        allParticipantIds.length > 0 &&
        allParticipantIds.every((userId) => selectedParticipants.includes(userId));

    const toggleParticipant = (userId: string) => {
        setSelectedParticipants(prev => {
            const isSelected = prev.includes(userId);
            if (isSelected) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    const toggleSelectAllParticipants = () => {
        if (allConnectionsSelected) {
            setSelectedParticipants((prev) => prev.filter((userId) => !allParticipantIds.includes(userId)));
            return;
        }

        setSelectedParticipants(allParticipantIds);
    };

    const confirmAvailabilityWarning = useCallback(
        (reasons: string[]) =>
            new Promise<boolean>((resolve) => {
                Alert.alert(
                    'Potential conflict',
                    `Planny found possible conflicts from your selected device calendars or the people you invited: ${reasons.join(', ')}. You can still send the plan if you want.`,
                    [
                        { text: 'Go back', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Send anyway', onPress: () => resolve(true) },
                    ],
                    {
                        cancelable: false,
                    }
                );
            }),
        []
    );

    const handleCreateEvent = async () => {
        if (!title) {
            Alert.alert('Required', 'Please enter an event title.');
            return;
        }

        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setLoading(false);
            Alert.alert('Not logged in', 'Please sign in again.');
            return;
        }

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const startAt = new Date(date);
        const endAt = new Date(date);

        if (isAllDay) {
            startAt.setHours(0, 0, 0, 0);
            endAt.setDate(endAt.getDate() + 1);
            endAt.setHours(0, 0, 0, 0);
        } else {
            startAt.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
            endAt.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
        }

        if (endAt <= startAt) {
            setLoading(false);
            Alert.alert('Invalid time', 'End time must be after start time.');
            return;
        }

        if (selectedParticipants.length > 0) {
            const availability = await checkAvailability(
                user.id,
                selectedParticipants,
                date,
                startAt,
                endAt
            );

            if (!availability.isAvailable) {
                const reasons = Array.from(new Set(availability.conflicts.map((conflict) => conflict.reason)));
                const shouldContinue = await confirmAvailabilityWarning(reasons);
                if (!shouldContinue) {
                    setLoading(false);
                    return;
                }
            }
        }

        try {
            const visibilityPayload = availableConnections.map((connection) => {
                const viewer_user_id = connection.otherUser.id;
                const isParticipant = selectedParticipants.includes(viewer_user_id);
                const level = isParticipant ? 'full_details' : (visibilitySettings[viewer_user_id] ?? defaultVisibility);

                return {
                    viewer_user_id,
                    level,
                    can_see_participants: level === 'full_details',
                };
            });

            const createdEventId = await createEventBundle({
                title,
                startAtUtc: startAt.toISOString(),
                endAtUtc: endAt.toISOString(),
                timezone,
                isAllDay,
                location,
                notes,
                participantIds: selectedParticipants,
                visibility: visibilityPayload,
                recurrenceKind: 'none',
            });

            let syncMessage = '';
            try {
                const syncableEvent = await getEventForSync(createdEventId);
                const syncResult = await syncPlannyEventToDeviceCalendars(syncableEvent);
                const syncedCalendarCount = 'syncedCalendars' in syncResult ? syncResult.syncedCalendars ?? 0 : 0;
                if (!syncResult.skipped && syncedCalendarCount > 0) {
                    syncMessage = ` Synced to ${syncedCalendarCount} device calendar${syncedCalendarCount === 1 ? '' : 's'}.`;
                }
            } catch (syncError: any) {
                syncMessage = ` Event created, but calendar sync failed: ${syncError?.message ?? 'unknown error'}.`;
            }

            Alert.alert('Success', `Event created and requests sent!${syncMessage}`, [
                { text: 'OK', onPress: () => router.push('/(tabs)') },
            ]);
        } catch (error: any) {
            Alert.alert('Error creating event', error?.message ?? 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.headerTitle}>Plan a Date</Text>

            {/* Basic Info */}
            <View style={styles.section}>
                <TextInput
                    style={styles.titleInput}
                    placeholder="Event Title"
                    placeholderTextColor="#888"
                    value={title}
                    onChangeText={setTitle}
                />

                <View style={styles.row}>
                    <CalendarIcon size={20} color="#666" />
                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePickerButton}>
                        <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
                    </TouchableOpacity>
                </View>

                {showDatePicker && (
                    <DateTimePicker
                        value={date}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                            setShowDatePicker(false);
                            if (selectedDate) setDate(selectedDate);
                        }}
                    />
                )}

                <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>All-Day Event</Text>
                    <Switch
                        value={isAllDay}
                        onValueChange={setIsAllDay}
                        trackColor={{ false: '#EAEAEA', true: '#FF9500' }}
                    />
                </View>

                {!isAllDay && (
                    <View style={styles.timeContainer}>
                        <View style={styles.timeRow}>
                            <Clock size={20} color="#666" />
                            <TouchableOpacity onPress={() => setShowStartTimePicker(true)} style={styles.datePickerButton}>
                                <Text style={styles.dateText}>Starts: {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                            </TouchableOpacity>
                            {showStartTimePicker && (
                                <DateTimePicker
                                    value={startTime}
                                    mode="time"
                                    display="default"
                                    onChange={(event, selectedTime) => {
                                        setShowStartTimePicker(false);
                                        if (selectedTime) setStartTime(selectedTime);
                                    }}
                                />
                            )}
                        </View>
                        <View style={styles.timeRow}>
                            <Clock size={20} color="transparent" />
                            <TouchableOpacity onPress={() => setShowEndTimePicker(true)} style={styles.datePickerButton}>
                                <Text style={styles.dateText}>Ends: {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                            </TouchableOpacity>
                            {showEndTimePicker && (
                                <DateTimePicker
                                    value={endTime}
                                    mode="time"
                                    display="default"
                                    onChange={(event, selectedTime) => {
                                        setShowEndTimePicker(false);
                                        if (selectedTime) setEndTime(selectedTime);
                                    }}
                                />
                            )}
                        </View>
                    </View>
                )}

                <View style={styles.inputRow}>
                    <MapPin size={20} color="#666" />
                    <TextInput
                        style={styles.textInput}
                        placeholder="Location"
                        placeholderTextColor="#888"
                        value={location}
                        onChangeText={setLocation}
                    />
                </View>

                <View style={styles.inputRow}>
                    <AlignLeft size={20} color="#666" />
                    <TextInput
                        style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                        placeholder="Notes"
                        placeholderTextColor="#888"
                        multiline
                        value={notes}
                        onChangeText={setNotes}
                    />
                </View>
            </View>

            {/* Participants (Consent) */}
            <View style={styles.section}>
                <Text style={styles.sectionHeader}><Users size={18} color="#FF9500" />  Who are you planning with?</Text>
                <Text style={styles.sectionDescription}>They will receive a request to accept this date.</Text>

                {!connectionsLoading && availableConnections.length > 0 ? (
                    <View style={styles.participantActions}>
                        <Text style={styles.selectionCount}>
                            {selectedParticipants.length} selected
                        </Text>
                        <TouchableOpacity
                            style={[styles.selectAllButton, allConnectionsSelected && styles.selectAllButtonActive]}
                            onPress={toggleSelectAllParticipants}
                        >
                            <Text style={[styles.selectAllButtonText, allConnectionsSelected && styles.selectAllButtonTextActive]}>
                                {allConnectionsSelected ? 'Clear all' : 'Select all'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {connectionsLoading ? (
                    <ActivityIndicator color="#FF9500" />
                ) : availableConnections.length === 0 ? (
                    <Text style={styles.emptyText}>You don&apos;t have any connections yet.</Text>
                ) : (
                    availableConnections.map(conn => {
                        const isSelected = selectedParticipants.includes(conn.otherUser.id);
                        const displayName = conn.otherUser.display_name || 'Unknown User';
                        const avatarLabel = displayName.charAt(0).toUpperCase();
                        return (
                            <TouchableOpacity
                                key={`participant-${conn.id}`}
                                style={[styles.personCard, isSelected && styles.personCardSelected]}
                                onPress={() => toggleParticipant(conn.otherUser.id)}
                            >
                                <View style={[styles.avatarPlaceholder, isSelected && styles.avatarPlaceholderSelected]}>
                                    <Text style={[styles.avatarText, isSelected && styles.avatarTextSelected]}>
                                        {avatarLabel}
                                    </Text>
                                </View>
                                <Text style={[styles.personName, isSelected && styles.personNameSelected]}>
                                    {displayName}
                                </Text>
                            </TouchableOpacity>
                        );
                    })
                )}
            </View>

            {/* Visibility (Privacy) */}
            <View style={styles.section}>
                <Text style={styles.sectionHeader}><Lock size={18} color="#FF9500" />  Privacy & Visibility</Text>
                <Text style={styles.sectionDescription}>
                    Selected participants automatically get full details. Choose what everyone else can see below.
                </Text>

                {!connectionsLoading && selectedParticipants.length > 0 ? (
                    <View style={styles.participantPrivacyNotice}>
                        <Text style={styles.participantPrivacyNoticeText}>
                            {selectedParticipants.length} participant{selectedParticipants.length === 1 ? '' : 's'} automatically get full details for this plan.
                        </Text>
                    </View>
                ) : null}

                {connectionsLoading ? (
                    <ActivityIndicator color="#FF9500" />
                ) : availableConnections.length === 0 ? (
                    <Text style={styles.emptyText}>You don&apos;t have any connections yet.</Text>
                ) : availableConnections.map(conn => {
                    const userId = conn.otherUser.id;
                    const isParticipant = selectedParticipants.includes(userId);
                    const currentVis = isParticipant ? 'full_details' : (visibilitySettings[userId] ?? defaultVisibility);
                    const displayName = conn.otherUser.display_name || 'Unknown User';

                    return (
                        <View key={`vis-${conn.id}`} style={[styles.visibilityRow, isParticipant && styles.visibilityRowLocked]}>
                            <View style={styles.visHeaderRow}>
                                <Text style={styles.visName}>{displayName}</Text>
                                {isParticipant ? (
                                    <View style={styles.participantBadge}>
                                        <Text style={styles.participantBadgeText}>Participant</Text>
                                    </View>
                                ) : null}
                            </View>

                            <View style={styles.visOptions}>
                                {VISIBILITY_LEVELS.map((level) => {
                                    const isSelectedLevel = currentVis === level;

                                    return (
                                        <TouchableOpacity
                                            key={level}
                                            disabled={isParticipant}
                                            style={[
                                                styles.visButton,
                                                isSelectedLevel && styles.visButtonSelected,
                                                isParticipant && !isSelectedLevel && styles.visButtonDisabled,
                                                isParticipant && isSelectedLevel && styles.visButtonLockedSelected,
                                            ]}
                                            onPress={() => setVisibilitySettings(prev => ({ ...prev, [userId]: level }))}
                                        >
                                            <Text
                                                style={[
                                                    styles.visButtonText,
                                                    isSelectedLevel && styles.visButtonTextSelected,
                                                    isParticipant && !isSelectedLevel && styles.visButtonTextDisabled,
                                                    isParticipant && isSelectedLevel && styles.visButtonTextLockedSelected,
                                                ]}
                                            >
                                                {VISIBILITY_LABELS[level]}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {isParticipant ? (
                                <Text style={styles.visHelperText}>
                                    Participants always receive full plan details while they are invited.
                                </Text>
                            ) : null}
                        </View>
                    );
                })}
            </View>

            <TouchableOpacity
                style={styles.submitButton}
                onPress={handleCreateEvent}
                disabled={loading}
            >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Send Plan</Text>}
            </TouchableOpacity>

            <View style={{ height: 100 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9F9F9',
    },
    content: {
        padding: 24,
        paddingTop: 60,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 24,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    titleInput: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#EAEAEA',
        paddingBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    datePickerButton: {
        marginLeft: 12,
        padding: 8,
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
    },
    dateText: {
        fontSize: 16,
        color: '#333',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#EAEAEA',
    },
    switchLabel: {
        fontSize: 16,
        color: '#333',
    },
    timeContainer: {
        marginBottom: 16,
        paddingLeft: 4,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    textInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        color: '#333',
        backgroundColor: '#F5F5F5',
        padding: 12,
        borderRadius: 8,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 4,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
    },
    participantActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    selectionCount: {
        fontSize: 13,
        color: '#666',
        fontWeight: '600',
    },
    selectAllButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#FFF4E5',
        borderWidth: 1,
        borderColor: '#FFCC8A',
    },
    selectAllButtonActive: {
        backgroundColor: '#FF9500',
        borderColor: '#FF9500',
    },
    selectAllButtonText: {
        fontSize: 13,
        color: '#C76A00',
        fontWeight: '700',
    },
    selectAllButtonTextActive: {
        color: '#fff',
    },
    emptyText: {
        color: '#888',
        fontStyle: 'italic',
    },
    participantPrivacyNotice: {
        marginBottom: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#FFF4E5',
        borderWidth: 1,
        borderColor: '#FFE0B2',
    },
    participantPrivacyNoticeText: {
        fontSize: 13,
        lineHeight: 18,
        color: '#A35A00',
        fontWeight: '600',
    },
    personCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#F5F5F5',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#EAEAEA',
    },
    personCardSelected: {
        backgroundColor: '#FF9500',
        borderColor: '#FF9500',
    },
    avatarPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#DDD',
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarPlaceholderSelected: {
        backgroundColor: '#fff',
    },
    avatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#666',
    },
    avatarTextSelected: {
        color: '#FF9500',
    },
    personName: {
        fontSize: 16,
        color: '#333',
    },
    personNameSelected: {
        color: '#fff',
        fontWeight: 'bold',
    },
    visibilityRow: {
        flexDirection: 'column',
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    visibilityRowLocked: {
        borderBottomColor: '#FFE0B2',
    },
    visHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        gap: 12,
    },
    visName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111',
        flex: 1,
    },
    participantBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: '#FFF4E5',
        borderWidth: 1,
        borderColor: '#FFCC8A',
    },
    participantBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#C76A00',
        textTransform: 'uppercase',
    },
    visOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    visButton: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 16,
        backgroundColor: '#F5F5F5',
        borderWidth: 1,
        borderColor: '#EAEAEA',
    },
    visButtonSelected: {
        backgroundColor: '#333',
        borderColor: '#333',
    },
    visButtonDisabled: {
        backgroundColor: '#FAF2E6',
        borderColor: '#F1D9B5',
    },
    visButtonLockedSelected: {
        backgroundColor: '#FF9500',
        borderColor: '#FF9500',
    },
    visButtonText: {
        fontSize: 12,
        color: '#666',
    },
    visButtonTextSelected: {
        color: '#fff',
        fontWeight: 'bold',
    },
    visButtonTextDisabled: {
        color: '#B99669',
    },
    visButtonTextLockedSelected: {
        color: '#fff',
        fontWeight: 'bold',
    },
    visHelperText: {
        marginTop: 10,
        fontSize: 12,
        lineHeight: 17,
        color: '#8A6A3E',
    },
    submitButton: {
        backgroundColor: '#FF9500',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#FF9500',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
