export type VisibilityLevel = 'hidden' | 'busy_only' | 'title_only' | 'full_details';

export type EventStatus = 'tentative' | 'confirmed' | 'canceled';

export type ParticipantStatus = 'pending' | 'accepted' | 'declined' | 'proposed_new_time';

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export type ConnectionStatus = 'pending' | 'active' | 'limited' | 'removed';
export type CalendarProvider = 'none' | 'apple' | 'google' | 'outlook' | 'ical';

export interface Connection {
  id: string;
  user_1_id: string;
  user_2_id: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  user_id: string;
  default_existing_visibility: VisibilityLevel;
  hide_everything_enabled: boolean;
  sleep_start_local: string;
  sleep_end_local: string;
  timezone: string;
  notification_privacy_mode: 'generic';
  push_notifications_enabled?: boolean;
  connected_calendar_provider?: CalendarProvider;
  calendar_push_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventProposal {
  id: string;
  event_id: string;
  proposer_id: string;
  start_at_utc: string;
  end_at_utc: string;
  timezone: string;
  note: string | null;
  status: ProposalStatus;
  created_at: string;
  updated_at: string;
}

export interface QrPayload {
  userId: string;
  token: string;
  expiresAt: string;
}
