export type VisibilityLevel = 'hidden' | 'busy_only' | 'title_only' | 'full_details';

export type EventStatus = 'tentative' | 'confirmed' | 'canceled';

export type ParticipantStatus = 'pending' | 'accepted' | 'declined' | 'proposed_new_time';

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export type ConnectionStatus = 'pending' | 'active' | 'limited' | 'removed';
export type HandshakeStatus = 'pending' | 'scanned' | 'confirmed' | 'connected' | 'expired' | 'failed';
export type CalendarProvider = 'none' | 'apple' | 'google' | 'outlook' | 'ical';
export type DetectedCalendarProvider = 'apple' | 'google' | 'outlook' | 'ical' | 'other';
export type NotificationKind =
  | 'event_invite'
  | 'event_response'
  | 'proposal_created'
  | 'proposal_decided'
  | 'connection_confirmed';

export interface Connection {
  id: string;
  user_1_id: string;
  user_2_id: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

export interface UserSummary {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface ConnectionWithOtherUser extends Connection {
  otherUser: UserSummary | null;
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

export interface ConnectionHandshake {
  id: string;
  user_1_id: string;
  user_2_id: string;
  scan_1_at: string | null;
  scan_2_at: string | null;
  confirm_1_at: string | null;
  confirm_2_at: string | null;
  status: HandshakeStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface HandshakeScanResult {
  handshake_id: string;
  status: HandshakeStatus;
  connection_id: string | null;
  scan_1_at: string | null;
  scan_2_at: string | null;
  confirm_1_at: string | null;
  confirm_2_at: string | null;
}

export interface HandshakeConfirmResult {
  handshake_id: string;
  status: HandshakeStatus;
  connection_id: string | null;
}

export interface DeviceCalendarOption {
  id: string;
  title: string;
  color: string | null;
  allowsModifications: boolean;
  provider: DetectedCalendarProvider;
  sourceName: string | null;
  ownerAccount: string | null;
  selected: boolean;
}

export interface DeviceCalendarSettings {
  selectedCalendarIds: string[];
  syncEnabled: boolean;
  updatedAt: string;
}

export interface SyncedCalendarEventMapping {
  calendarId: string;
  nativeEventId: string;
  provider: DetectedCalendarProvider;
}

export interface SyncableCalendarEvent {
  id: string;
  title: string;
  location: string | null;
  notes: string | null;
  status: EventStatus;
  is_all_day: boolean;
  start_at_utc: string;
  end_at_utc: string;
  timezone: string;
}
