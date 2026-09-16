# Phase 5 — CyberDaddy supervision

CyberDaddy is a supervision capability of Soren. It does not introduce another character, chat identity, or notification channel. A due follow-up is delivered as a Soren assistant message through the Phase 4 event service.

## Data and controls

Migration 7 adds `cyberdaddy_domains`, `commitments`, and `commitment_followups`. Six stable domains are installed disabled by default: sleep, study, career, fitness, projects, and habits. The user must enable the global switch and each domain before follow-ups are eligible.

The operational UI lives in Timeline. It exposes the global switch, local pause, quiet hours, per-domain intensity, commitment creation, completion, cancellation, and follow-up history. The Settings global proactive pause also stops all CyberDaddy activity.

## Pulse behavior

The scheduler evaluates once per minute and handles at most one due commitment per pulse. It checks, in order:

`enabled → global/local pause → quiet hours → daily cap → due commitment → recent context → delivery`

Gentle sends one soft reminder. Normal can follow up three times. Daddy can follow up five times with bounded intervals. Recent user messages that indicate illness, exhaustion, or a family emergency change the action to `REDUCE_TASK` or `CHECK_IN`. Follow-ups are capped at six delivered messages per local day.

Every delivery uses a stable dedupe key based on the commitment and follow-up sequence. Delivery, reason, action, event ID, and next eligible time are persisted before another pulse can act on the same commitment. Completed and cancelled commitments never become eligible.

## API

- `GET /api/cyberdaddy` — full supervision snapshot.
- `PATCH /api/cyberdaddy` — enable, pause, or update quiet hours.
- `PATCH /api/cyberdaddy/domains/:id` — enable a domain or change its intensity.
- `POST /api/commitments` — create a structured commitment.
- `PATCH /api/commitments/:id` — edit, complete, cancel, or reactivate a commitment.
- `POST /api/cyberdaddy/pulse` — request one evaluation pulse; used by diagnostics and functional tests.

Ordinary legacy reminders are delivered in-app when due. Important reminders use the Phase 4 Chat and optional system-notification policy. Creating a reminder no longer delivers it early.

## Current boundary

Phase 5 context evaluation uses recent local Chat text and deterministic rules. Phone state, device activity, location, random wakeups, and a separate Cyberboss persona remain outside this phase.
