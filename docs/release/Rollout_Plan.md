# Staged Rollout Plan

## Objectives
- Verify stability, performance, and key funnel metrics as user base scales.
- Ensure background location and notifications behave as expected in the wild.

## Stages
1. 5% rollout — Monitor for 24–48 hours
   - Crash-free users >= 99.5%
   - API success rate >= 99.0% (dashboard SLA)
   - p95 API latency < 800ms
   - DAU > 50 with no critical errors
2. 20% rollout — Next 48 hours
   - Maintain same thresholds
   - Retention preliminary checks (D1)
3. 50% rollout — 72 hours
   - Maintain thresholds; review trial starts and conversion
4. 100% rollout — After 1–2 weeks

## Rollback Triggers
- Crash-free < 98.5% over 6h window
- API success < 98% for 30m
- Significant spike in battery usage complaints
- Elevated false positive geofences

## Monitoring (Dashboard)
- Key metrics and charts in `backend/src/dashboard/`
  - DAU, Tasks, Completion, Engagement
  - Conversion funnel
  - SLA summary and latency chart
  - Launch KPIs card

## Communications
- Prepare release notes
- Update support FAQ for known issues
- Internal on-call schedule for the first 72 hours

## Post-Release Analysis
- Retention cohorts (D1/D7/D30)
- Trial start and conversion rates
- Notification engagement vs. completion
