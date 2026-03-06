import { supabase } from './supabase';

export interface TimeSlot {
    start: Date;
    end: Date;
}

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
    const startStr = startTime.toTimeString().split(' ')[0];
    const endStr = endTime.toTimeString().split(' ')[0];
    const windowStart = new Date(date);
    const windowEnd = new Date(date);
    windowStart.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
    windowEnd.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);

    const conflicts: { userId: string; reason: string }[] = [];

    for (const targetId of targetUserIds) {
        // 1. Check their events
        const { data: events } = await supabase
            .from('events')
            .select('id, is_all_day, start_time, end_time, start_at_utc, end_at_utc')
            .eq('creator_id', targetId)
            .or(`date.eq.${dateStr},start_at_utc.gte.${windowStart.toISOString()},end_at_utc.lte.${windowEnd.toISOString()}`);

        if (events) {
            for (const event of events) {
                if (event.is_all_day) {
                    conflicts.push({ userId: targetId, reason: 'Has an all-day event' });
                    break;
                }

                // Simple overlapping time check
                if (event.start_time && event.end_time) {
                    if (
                        (startStr >= event.start_time && startStr < event.end_time) ||
                        (endStr > event.start_time && endStr <= event.end_time) ||
                        (startStr <= event.start_time && endStr >= event.end_time)
                    ) {
                        conflicts.push({ userId: targetId, reason: 'Has a conflicting event' });
                        break;
                    }
                }
            }
        }

        const { data: blocks } = await supabase
            .from('availability_blocks')
            .select('start_time, end_time')
            .eq('user_id', targetId)
            .lt('start_time', windowEnd.toISOString())
            .gt('end_time', windowStart.toISOString());

        if (blocks && blocks.length > 0) {
            conflicts.push({ userId: targetId, reason: 'Has an unavailable time block' });
        }
    }

    return {
        isAvailable: conflicts.length === 0,
        conflicts
    };
};
