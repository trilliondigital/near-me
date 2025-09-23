# PRD — Near Me

> **Status:** Pending Approval

> **Updated:** [`Sun, Sep 21`](day://2025.09.21)

> **Related:** [Use Case Library](./Use Case Library.md), [Feature Specs](./Feature Specs.md), [Value Metrics](./Value Metrics.md), [Experiment Plan](./Experiment Plan.md), [Tracking Plan](./Tracking Plan.md)

---

[← Back](./✱ Near Me.md#near-me--wiki)

## Goal

Help users complete context tasks via **location-triggered reminders** that persist until completion—without draining battery or compromising privacy.

## KPIs

- Activation: ≥70% finish onboarding; ≥60% enable Location & Notifications
- Value: ≥40% create first task D1; ≥25% receive a geofence nudge D3
- Outcome: ≥30% tasks completed within 24h of first nudge
- Retention: D7 ≥25%, D30 ≥15%
- Monetization: trial→keep ≥45%; monthly conversion ≥3–5%

## v1.0 Scope

- Place/category tagging; tiered geofences **5/3/1 mi**, arrival, +5m
- POI categories: gas, pharmacy, grocery (extensible)
- Persistence with cooldowns; snooze/mute
- Onboarding + **soft paywall**
- Core analytics

## Non-Goals (v1.0)

ML suggestions, route prediction, family sharing, web client (post-1.0).

## User Stories

- “Get gas” near any station (category).
- “Pick up prescription” at chosen / any pharmacy with tiered nudges.
- “Defrost chicken” on home arrival + T+5m.
- “Pay for parking” on approach to work + arrival + T+5m.

Acceptance criteria: [Use Case Library](./Use Case Library.md).

## Experience Principles

Calm by default (blue), gratification on completion (green pulse), premium surfaces for upsells (black). Clear snooze controls. Respect Focus/DND.

## Constraints

CoreLocation / GeofencingClient limits; geofence quotas; battery ≤3% daily (P50). On-device-first checks; minimal data.

## Rollout

TestFlight/Play Internal → staged rollout with success gates (crash-free ≥99.5%, TTFC ≤48h).

## Risks

Notification fatigue, battery, POI accuracy, platform policy changes → see [Risk Register](./Risk Register.md).