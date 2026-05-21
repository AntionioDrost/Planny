# Planny Find Time Design

Date: 2026-05-21
Status: Proposed and user-approved for planning
Scope: Product and technical design only. No implementation in this document.

## Summary

`Find time` is a new mini-flow inside `Plan a Date` that helps one user find good planning moments with one connection. It is privacy-first, consent-driven, and intentionally soft in tone.

The feature does not expose another person's raw calendar, free/busy grid, event titles, locations, or notes. Instead, it combines availability sources behind the scenes and returns:

- 3-5 concrete suggested moments
- a high-level summary such as `Friday evenings often work well`
- a handoff into the existing event proposal flow

Version 1 is optimized for one-to-one planning. Group planning remains manual in v1.

## Goals

- Reduce back-and-forth when two people want to find a time together.
- Let users discover overlap without feeling like they are inspecting someone else's agenda.
- Keep availability sharing fully mutual and revocable.
- Reuse the existing event proposal flow once a good moment is found.

## Non-Goals

- Full multi-person group matching in v1
- Showing a visible calendar grid or time-block timeline for another user
- Revealing why another user is busy
- Adding a request flow for availability sharing in v1
- Real-time direct reads of another user's local device calendar from the requester's device

## User Experience

### Entry Point

`Plan a Date` gets a clear top-level choice:

- `Manual`
- `Find time`

Choosing `Find time` starts a separate mini-flow rather than adding more fields to the existing manual form.

### Find Time Flow

1. The user selects exactly one active connection.
2. Planny checks whether availability sharing is mutually enabled for that relationship.
3. If mutual sharing is active, the user selects either:
   - a moment type, such as `Coffee`, `Dinner`, or `Night out`
   - or `Custom duration`
4. The user can optionally narrow the search with a lightweight preference such as `This week`, `This weekend`, or `Evening`.
5. Planny shows:
   - 3-5 suggested moments
   - one short summary sentence about patterns or constraints
6. When the user taps a suggestion, Planny opens the existing proposal flow with the date and time prefilled.
7. If sharing is not mutual, or if no overlap is found, Planny falls back to manual planning with clear copy and a button to continue manually.

### Tone and Output Shape

The feature should feel charming and calm rather than overly analytical.

Good examples:

- `Friday evening works well`
- `This weekend has limited overlap`
- `A short coffee looks easier than dinner this week`

Bad examples:

- `Sam is free from 14:00 to 15:30`
- `Sam has work on Thursday`
- any language that reveals a private event or exact schedule structure

## Privacy and Consent Model

### Relationship-Level Sharing

Availability sharing is configured per connection, not globally.

Each direction is stored separately:

- User A can choose to share their availability with User B
- User B can separately choose to share their availability with User A

`Find time` only becomes active when both directions are enabled. This is strict mutual consent, not a soft opt-in and not a request flow.

### Revocation

If either user disables sharing, the relationship immediately stops qualifying for `Find time`. The UI must revert to the manual fallback and stop returning suggestions for that pair.

### Connected Calendar Consent

Connected calendars may contribute to smart matching only if the calendar owner has already opted into that behavior when connecting calendars.

This consent belongs to the calendar owner, not to the requesting user and not to a per-search prompt. In practice:

- connecting calendars already grants or denies permission for those calendars to inform smart matching
- `Find time` uses that existing consent
- no extra consent prompt is shown inside `Find time`

### Privacy Boundary

Planny must never expose raw synced calendar entries from another user. Synced calendars can influence suggestions only through stored busy windows and coarse summary generation.

## Availability Sources

The v1 match engine can use these sources:

- the initiator's Planny events
- the target user's Planny events
- availability blocks
- sleep hours from user preferences
- the initiator's connected calendars that are allowed for matching
- the target user's connected calendars that are allowed for matching

To support the target user's connected calendars safely, Planny should not rely on live local reads from another device at query time. Instead, each user syncs privacy-safe busy windows to the backend for a short rolling horizon.

## Suggested Data Model

### 1. Relationship Availability Sharing

Add a new table, for example `connection_availability_shares`:

- `owner_user_id uuid not null`
- `other_user_id uuid not null`
- `share_availability_enabled boolean not null`
- `updated_at timestamptz not null`

Constraints:

- unique on `(owner_user_id, other_user_id)`
- both users must already have an active connection

Purpose:

- store directional consent cleanly
- allow the app to compute a mutual sharing state by checking both rows

### 2. Calendar Matching Preference

Add a server-backed preference to indicate whether a user's connected calendars may inform smart matching. A boolean on `user_preferences` is likely enough, for example:

- `calendar_matching_enabled boolean not null default false`

This is distinct from local-only device sync flags because other users' matching depends on data available server-side.

### 3. Synced Busy Windows

Add a new derived table, for example `calendar_busy_windows`:

- `id uuid primary key`
- `user_id uuid not null`
- `source_provider text not null`
- `start_at_utc timestamptz not null`
- `end_at_utc timestamptz not null`
- `is_all_day boolean not null default false`
- `generated_at timestamptz not null`
- `expires_at timestamptz not null`

Purpose:

- store privacy-safe busy intervals from connected calendars
- support matching without exposing underlying event details
- keep windows ephemeral and refreshable

The busy-window sync should only cover a short future horizon, such as the next 14 days.

## Matching Logic

### Inputs

- initiator user id
- target user id
- moment type or custom duration
- optional preference window such as `this_week`, `this_weekend`, or `evening`

### Preset Types

Initial presets can be hardcoded in v1:

- `Coffee`: 45-60 minutes, daytime-leaning
- `Dinner`: 90-120 minutes, early evening-leaning
- `Night out`: 2-4 hours, Friday/Saturday evening-leaning
- `Custom duration`: user-provided duration

### Search Horizon

Search a short rolling horizon, recommended at 7-14 days. A 14-day default is a good first version because it is useful without feeling invasive.

### Ranking Rules

The v1 engine should prioritize clarity over sophistication:

1. Exclude hard conflicts first.
2. Build candidate overlaps that satisfy the required duration.
3. Rank by fit with the selected moment type.
4. Prefer simpler, sooner, and more socially natural slots.
5. Return only a small number of suggestions.

### Summary Generation

The summary sentence must stay high-level and privacy-safe. It may mention:

- broad time-of-day tendencies
- whether the near-term window is tight
- whether a shorter plan is easier than a longer one

It must not reveal:

- exact free intervals
- busy reasons
- named external calendar events

## UI Components

### Planner Entry

The current planning screen gains a top-level mode choice for `Manual` vs `Find time`.

### Find Time Screen

The dedicated flow screen handles:

- selecting one connection
- selecting a moment type or custom duration
- selecting an optional preference window
- displaying suggestions and summary
- continuing into proposal creation

### Connection-Level Setting

Each connection needs a place where the user can toggle `Share my availability with this person`.

This should live with the relationship itself, likely in connection management or the connection detail surface, rather than in global privacy defaults.

### Calendar Consent Surface

The calendar connection flow needs explicit copy that connected calendars can optionally inform smart matching.

## Data Flow

1. User opens `Plan a Date` and chooses `Find time`.
2. App loads active connections plus mutual sharing states.
3. User selects one connection and a planning style.
4. App calls a backend match service.
5. Backend verifies mutual consent.
6. Backend builds an availability picture from:
   - Planny events
   - availability blocks
   - sleep hours
   - synced busy windows where allowed
7. Backend ranks a small set of suggestions and generates one summary line.
8. App displays the suggestions.
9. User picks one and enters the existing proposal flow with prefilled timing.

## Error Handling and Fallbacks

### No Mutual Sharing

Show clear copy explaining that shared availability is not active for this connection. Offer a button to continue with manual planning.

### No Overlap

Show a gentle empty state such as `There is not much overlap this week` and offer manual planning immediately.

### Partial Signal Quality

If a user's connected calendars are unavailable or stale, the service may still proceed with Planny-native data. In that case the copy should become less absolute, for example:

- `Possible good moments`
- `Best matches based on current Planny availability`

### Stale Busy Windows

If synced busy windows are expired, the match service should ignore them rather than treat them as permanent conflicts.

## Security and Privacy Requirements

- RLS must prevent users from reading another user's raw busy-window rows unless access is explicitly required for the matching service design.
- Client APIs must not return another user's external calendar titles, descriptions, attendees, or locations.
- Summary generation must operate on derived data only.
- Audit logging should prefer service-level metadata over storing sensitive underlying event text.

## Testing Strategy

### Unit Tests

- ranking behavior for each moment type
- custom duration behavior
- summary generation that stays coarse and safe

### Integration Tests

- mutual sharing required before suggestions appear
- revocation immediately disables suggestions
- connected calendar consent respected
- stale busy windows ignored correctly
- no-overlap fallback returns manual option

### Privacy Tests

- responses never contain raw external calendar event metadata
- responses never expose exact free/busy grids for the target user
- connection-level access checks work in both directions

## Rollout Notes

The feature should launch behind a feature flag, for example `findTime`, so the UI and backend behavior can be iterated safely.

## Recommendation

Build `Find time` as a separate mini-flow inside `Plan a Date`, optimized for one-to-one planning. Keep the first release intentionally narrow:

- one-to-one only
- strict mutual consent
- suggestions plus one coarse summary
- manual fallback always available

This version is useful, distinct, and aligned with Planny's privacy-first product identity without overreaching into group scheduling or visible agenda sharing.
