import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '@/utils/supabase';
import { useLocalSearchParams, router } from 'expo-router';
import { Calendar as CalendarIcon, Clock, MapPin, AlignLeft, UserCheck, XCircle, PenTool, Lock } from 'lucide-react-native';
import { proposeEventTime } from '@/services/event-service';

export default function EventDetailScreen() {
    const { id } = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [eventData, setEventData] = useState<any>(null);
    const [participantStatus, setParticipantStatus] = useState<string | null>(null);
    const [myUserId, setMyUserId] = useState<string | null>(null);

    const loadEventDetails = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setLoading(false);
            return;
        }
        setMyUserId(user.id);

        // 1. Fetch Event (RLS will inherently block this if they have NO access)
        // We are selecting the creator profile join here too
        const { data: event, error } = await supabase
            .from('events')
            .select('*, creator:creator_id(display_name)')
            .eq('id', id)
            .single();

        if (error || !event) {
            Alert.alert('Error', 'Event not found or you do not have permission to view it.');
            setLoading(false);
            router.back();
            return;
        }

        let resultEvent = { ...event, access_level: 'full_details' };

        // 2. Determine their EXACT relationship to this event
        if (event.creator_id !== user.id) {
            // Check if they are a participant (implies full access & requires RSVP)
            const { data: participantData } = await supabase
                .from('event_participants')
                .select('*')
                .eq('event_id', id)
                .eq('user_id', user.id)
                .single();

            if (participantData) {
                setParticipantStatus(participantData.status);
            } else {
                // Not a participant. They must be viewing this via a visibility rule.
                const { data: visData } = await supabase
                    .from('event_visibility')
                    .select('*')
                    .eq('event_id', id)
                    .eq('viewer_user_id', user.id)
                    .single();

                if (visData) {
                    resultEvent.access_level = visData.level;
                    // Apply masking based on privacy level
                    if (visData.level === 'busy_only') {
                        resultEvent.title = 'Busy';
                        resultEvent.location = null;
                        resultEvent.notes = null;
                    } else if (visData.level === 'title_only') {
                        resultEvent.location = null;
                        resultEvent.notes = null;
                    }
                }
            }
        }

        setEventData(resultEvent);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        if (id) {
            void loadEventDetails();
        }
    }, [id, loadEventDetails]);

    const updateResponse = async (status: 'accepted' | 'declined') => {
        if (!myUserId) return;
        setLoading(true);

        const { error } = await supabase
            .from('event_participants')
            .update({ status })
            .eq('event_id', id)
            .eq('user_id', myUserId);

        if (!error) {
            setParticipantStatus(status);
        } else {
            Alert.alert('Error updating response');
        }
        setLoading(false);
    };

    const proposeAlternative = async () => {
        if (!eventData?.start_at_utc || !eventData?.end_at_utc) {
            Alert.alert('Not available', 'This event is missing date-time fields.');
            return;
        }

        const currentStart = new Date(eventData.start_at_utc);
        const currentEnd = new Date(eventData.end_at_utc);
        const nextDayStart = new Date(currentStart.getTime() + 24 * 60 * 60 * 1000);
        const nextDayEnd = new Date(currentEnd.getTime() + 24 * 60 * 60 * 1000);

        try {
            await proposeEventTime(
                eventData.id,
                nextDayStart.toISOString(),
                nextDayEnd.toISOString(),
                eventData.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
                'Auto-proposed next day from event detail'
            );
            Alert.alert('Proposal sent', 'A counter-proposal has been sent to the event creator.');
        } catch (error: any) {
            Alert.alert('Proposal failed', error?.message ?? 'Could not submit proposal.');
        }
    };

    if (loading || !eventData) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color="#FF9500" />
            </View>
        );
    }

    const isCreator = eventData.creator_id === myUserId;
    const isPendingParticipant = participantStatus === 'pending';
    const isLimitedView = eventData.access_level === 'busy_only' || eventData.access_level === 'title_only';

    return (
        <ScrollView style={styles.container}>
            {isLimitedView && (
                <View style={styles.privacyBanner}>
                    <Lock size={16} color="#B8860B" />
                    <Text style={styles.privacyBannerText}>
                        You are viewing a limited privacy version of this event.
                    </Text>
                </View>
            )}

            <View style={styles.header}>
                <Text style={styles.title}>{eventData.title}</Text>
                <Text style={styles.creatorText}>
                    Planned by {isCreator ? 'You' : eventData.creator?.display_name || 'Someone'}
                </Text>
            </View>

            <View style={styles.card}>
                <View style={styles.detailRow}>
                    <CalendarIcon size={20} color="#666" />
                    <Text style={styles.detailText}>{new Date(eventData.date).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
                </View>

                <View style={styles.detailRow}>
                    <Clock size={20} color="#666" />
                    <Text style={styles.detailText}>
                        {eventData.is_all_day
                            ? 'All Day'
                            : `${eventData.start_time?.substring(0, 5)} - ${eventData.end_time?.substring(0, 5)}`}
                    </Text>
                </View>

                {eventData.location && (
                    <View style={styles.detailRow}>
                        <MapPin size={20} color="#666" />
                        <Text style={styles.detailText}>{eventData.location}</Text>
                    </View>
                )}

                {eventData.notes && (
                    <View style={[styles.detailRow, { alignItems: 'flex-start' }]}>
                        <AlignLeft size={20} color="#666" style={{ marginTop: 2 }} />
                        <Text style={styles.notesText}>{eventData.notes}</Text>
                    </View>
                )}
            </View>

            {/* Mutuality / Consent Block */}
            {participantStatus && !isCreator && (
                <View style={styles.responseContainer}>
                    <Text style={styles.responseTitle}>Your Response</Text>

                    {isPendingParticipant ? (
                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={() => updateResponse('accepted')}>
                                <UserCheck size={20} color="#fff" />
                                <Text style={styles.acceptBtnText}>Accept</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={() => updateResponse('declined')}>
                                <XCircle size={20} color="#D32F2F" />
                                <Text style={styles.declineBtnText}>Decline</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={[styles.statusBadge, participantStatus === 'accepted' ? styles.statusAccepted : styles.statusDeclined]}>
                            {participantStatus === 'accepted' ? <UserCheck size={20} color="#2E7D32" /> : <XCircle size={20} color="#D32F2F" />}
                            <Text style={[styles.statusText, participantStatus === 'accepted' ? { color: '#2E7D32' } : { color: '#D32F2F' }]}>
                                You have {participantStatus} this date.
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity style={styles.proposeBtn} onPress={proposeAlternative}>
                        <PenTool size={16} color="#666" />
                        <Text style={styles.proposeBtnText}>Propose another time</Text>
                    </TouchableOpacity>
                </View>
            )}

            {isCreator && (
                <View style={styles.creatorActions}>
                    <TouchableOpacity style={styles.editBtn}>
                        <Text style={styles.editBtnText}>Edit Event</Text>
                    </TouchableOpacity>
                </View>
            )}

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9F9F9',
    },
    privacyBanner: {
        backgroundColor: '#FFF8E1',
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    privacyBannerText: {
        color: '#8F6A00',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 8,
    },
    header: {
        padding: 24,
        paddingTop: 40,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 8,
    },
    creatorText: {
        fontSize: 16,
        color: '#888',
    },
    card: {
        backgroundColor: '#fff',
        marginHorizontal: 24,
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 24,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    detailText: {
        fontSize: 18,
        color: '#333',
        marginLeft: 16,
    },
    notesText: {
        fontSize: 16,
        color: '#555',
        marginLeft: 16,
        flex: 1,
        lineHeight: 24,
    },
    responseContainer: {
        paddingHorizontal: 24,
        marginBottom: 40,
    },
    responseTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#111',
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 16,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    acceptBtn: {
        backgroundColor: '#FF9500',
        borderColor: '#FF9500',
    },
    acceptBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8,
    },
    declineBtn: {
        backgroundColor: '#FFEEED',
        borderColor: '#FFD1CE',
    },
    declineBtnText: {
        color: '#D32F2F',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    statusAccepted: {
        backgroundColor: '#E8F5E9',
    },
    statusDeclined: {
        backgroundColor: '#FFEEED',
    },
    statusText: {
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 12,
    },
    proposeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    proposeBtnText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
    creatorActions: {
        paddingHorizontal: 24,
    },
    editBtn: {
        backgroundColor: '#F5F5F5',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    editBtnText: {
        color: '#333',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
