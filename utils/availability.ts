import { supabase } from './supabase';
import { getDeviceCalendarConflicts } from '@/services/device-calendar-service';

export interface TimeSlot {
    start: Date;
    end: Date;
}

type AvailabilityEventRow = {
    is_all_day: boolean | null;
};

export const checkAvailability = async (
    userId: string,
    targetUserIds: string[],
    date: Date,
    startTime: Date,
    endTime: Date
): Promise<{
    isAvailable: boolean;
    conflicts: { userId: string; reason: string }[]
}> => {
    const dateStr = date.toISOString().split('T')[0];
    const windowStart = new Date(date);
    const windowEnd = new Date(date);
    windowStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    windowEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

    const conflicts: { userId: string; reason: string }[] = [];

    const deviceCalendarConflicts = await getDeviceCalendarConflicts(windowStart, windowEnd);
    if (deviceCalendarConflicts.length > 0) {
        const preview = deviceCalendarConflicts
            .slice(0, 2)
            .map((conflict) => conflict.title)
            .join(', ');
        conflicts.push({
            userId,
            reason: preview
                ? `Your selected device calendar is busy (${preview})`
                : 'Your selected device calendar is busy',
        });
    }

    for (const targetId of targetUserIds) {
        // 1. Check their events using real overlap logic against UTC timestamps.
        const { data: events } = await supabase
            .from('events')
            .select('id, is_all_day, start_at_utc, end_at_utc')
            .eq('creator_id', targetId)
            .neq('status', 'canceled')
            .lt('start_at_utc', windowEnd.toISOString())
            .gt('end_at_utc', windowStart.toISOString());

        if (events?.length) {
            const hasAllDayEvent = events.some((event: AvailabilityEventRow) => event.is_all_day);
            conflicts.push({
                userId: targetId,
                reason: hasAllDayEvent ? 'Has an all-day event' : 'Has a conflicting event',
            });
            continue;
        }

        const { data: blocks } = await supabase
            .from('availability_blocks')
            .select('start_time, end_time')
            .eq('user_id', targetId)
            .lt('start_time', windowEnd.toISOString())
            .gt('end_time', windowStart.toISOString());

        if (blocks && blocks.length > 0) {
            conflicts.push({ userId: targetId, reason: 'Has an unavailable time block' });
            continue;
        }

        // Fallback for legacy date-only events if they still exist without UTC timestamps.
        const { data: legacyEvents } = await supabase
            .from('events')
            .select('id, is_all_day')
            .eq('creator_id', targetId)
            .neq('status', 'canceled')
            .eq('date', dateStr)
            .is('start_at_utc', null);

        if (legacyEvents?.length) {
            conflicts.push({
                userId: targetId,
                reason: legacyEvents.some((event: AvailabilityEventRow) => event.is_all_day)
                    ? 'Has an all-day event'
                    : 'Has a conflicting event',
            });
            continue;
        }
    }

    return {
        isAvailable: conflicts.length === 0,
        conflicts
    };
};
