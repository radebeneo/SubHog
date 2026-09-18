# PostHog Self-driving setup report

## Summary

PostHog Self-driving is configured with Session Replay, Error Tracking, and Support enabled, plus responders for health checks, error issues, and support tickets. Two Replay Vision monitors are armed to send high-confidence findings to the [Self-driving inbox](https://eu.posthog.com/project/276104/inbox). Findings should start appearing within about 30 minutes after data begins arriving.

## AI data processing

Approved by the setup wizard before this run.

## GitHub

The PostHog GitHub App was already connected before this run.

## Products enabled

| Product | Status | Notes |
| --- | --- | --- |
| Session Replay | Enabled but inert on mobile | The server-side setting is on. The React Native SDK still needs mobile Replay configuration before recordings can arrive. |
| Error Tracking | Enabled but inert on mobile | The server-side setting is on. The React Native SDK still needs mobile exception-capture configuration before it can supply Error Tracking data. |
| Support | Enabled | Support tickets will reach the responder once an inbound email, inbox, or Slack channel is connected in PostHog. |

The app uses `posthog-react-native`, not `posthog-js`; no browser-init overrides were applicable.

## Signal sources

| Source product | Source type | Action |
| --- | --- | --- |
| `health_checks` | `health_issue` | Enabled |
| `error_tracking` | `issue_created` | Enabled |
| `error_tracking` | `issue_reopened` | Enabled |
| `error_tracking` | `issue_spiking` | Enabled |
| `conversations` | `ticket` | Enabled |
| `signals_scout` | `cross_source_issue` | Left on by default; no opt-out row was created. |
| `session_replay` | `session_analysis_cluster` | Deliberately skipped; this retired source is replaced by the Replay Vision monitors below. |
| `replay_vision` | — | Deliberately skipped; each scanner authorizes its own inbox findings with `emits_signals: true`. |

## Connected tools

No external connected tools were selected. No data-warehouse source or external responder was added.

## Scout troop

**Enabled (2):**

| Scout | Why it is enabled |
| --- | --- |
| `signals-scout-general` | Broad cross-product monitoring for meaningful patterns not owned by a specialist. |
| `signals-scout-health-checks` | Watches PostHog setup health and groups actionable instrumentation issues. |

**Disabled (25):**

| Scouts | Reason |
| --- | --- |
| `signals-scout-ai-observability`, `signals-scout-apm`, `signals-scout-logs` | No AI observability, backend tracing, or PostHog logs evidence was found. |
| `signals-scout-anomaly-detection`, `signals-scout-product-analytics`, `signals-scout-observability-gaps`, `signals-scout-insight-alerts` | No established event baseline, saved flow, insight coverage, or alerting surface is available yet. |
| `signals-scout-conversations` | Support is covered by the native Support ticket responder. |
| `signals-scout-csp-violations` | No CSP reporting configuration was found. |
| `signals-scout-customer-analytics` | The current product is local-device, single-user software; no B2B account analytics surface was found. |
| `signals-scout-data-pipelines`, `signals-scout-data-warehouse` | No data pipeline or warehouse source is connected. |
| `signals-scout-error-tracking` | Covered by the native Error Tracking responders. |
| `signals-scout-experiments`, `signals-scout-feature-flags`, `signals-scout-surveys` | No active experiments, feature flags, or surveys were found. |
| `signals-scout-inbox-validation` | No prior Self-driving fixes exist to validate yet. |
| `signals-scout-mcp-tool-calls`, `signals-scout-skills-store`, `signals-scout-tasks` | No active product surface for MCP telemetry, skills-store hygiene, or PostHog Tasks was found. |
| `signals-scout-replay-vision` | It remains off until scanners accumulate observations; direct scanner findings already route to the inbox. |
| `signals-scout-revenue-analytics` | No payment SDK or revenue-data source was found. |
| `signals-scout-session-replay` | Covered by the Replay Vision scanners below. |
| `signals-scout-web-analytics`, `signals-scout-web-vitals` | The product is mobile-first; no web traffic or web-vitals surface was identified. |

**Verified budget:** 100 runs/day maximum; 0 used today; 100 remaining today. The current early-access banner states that projects receive up to 100 scout runs/day and directs requests for more capacity to the Self-driving team.

## Custom scouts

No custom scouts were created: the proposal to watch account-access health and subscription-management engagement was declined. Those were the strongest product-specific candidates because they could identify activity collapses while the generic troop remains quiet. A custom subscription-creation/completion scout was ruled out because the present event taxonomy has no captured creation or completion pair.

If a future custom scout becomes noisy, set `emit: false` on its PostHog scout config to switch it to dry-run.

## Replay Vision scanners

A scanner is an LLM that watches individual session recordings on a schedule and pushes high-confidence observations into the inbox. These are the only items in this setup that spend Replay Vision quota. Each finding arrives at half weight and requires corroboration before it can be promoted into a report.

| Brief | Scanner | Status | Scope | Sampling | Estimate |
| --- | --- | --- | --- | --- | --- |
| Breakage monitor | [Subscription tracker sign-up breakage](https://eu.posthog.com/project/276104/replay-vision/01a0aa20-f78c-7e6d-b2ab-88a15349cbcc) | Created | Sessions on the account-sign-up route, which is the primary account-creation completion flow. It looks for visibly broken account creation, email verification, dashboard arrival, and subscription-detail behavior. | 50% | 0 observations/month; 0 credits/month (5 credits/observation) |
| Frustration monitor | [Subscription tracker user frustration](https://eu.posthog.com/project/276104/replay-vision/01a0aa20-f86c-7993-85d5-40b34cfae673) | Created | Sessions containing a rage click only; it looks for visible struggle across account creation, verification, subscription details, and settings. | 100% | 0 observations/month; 0 credits/month (5 credits/observation) |

The monitors are disjoint by design: the breakage monitor is route-scoped, while the frustration monitor is gated only by rage clicks. Replay Vision currently has no recordings, so the scanners are armed and will begin work when mobile recordings arrive. The organization has 2,500 remaining Replay Vision credits and is not exhausted.

## Files modified or created

| File | Change |
| --- | --- |
| `posthog-self-driving-report.md` | Created this setup report. |

No application source files were changed.

## Follow-ups

- [ ] Configure the React Native SDK for Session Replay and exception capture so the enabled server-side products receive mobile data.
- [ ] Connect an inbound Support channel (email, inbox, or Slack) in PostHog so support tickets can reach the enabled responder.
- [ ] Generate real sessions, including account creation and subscription-management activity, to establish data for scouts and Replay Vision.
- [ ] Consider adding explicit subscription creation, completion, and deletion events before enabling a domain-specific subscription-flow scout.
- [ ] Rate future scanner observations in their scanner pages to turn feedback into configuration recommendations.

## What happens next

The scout coordinator picks up fresh configs within about 30 minutes. Each scout run draws from the verified daily budget, and findings cluster into reports in the [Self-driving inbox](https://eu.posthog.com/project/276104/inbox); immediately actionable reports can start coding tasks.

## References

- [PostHog Self-driving signal sources](https://posthog.com/docs/self-driving/inbox/sources)
- [PostHog Scouts](https://posthog.com/docs/self-driving/scouts)
- [Creating Replay Vision scanners](https://posthog.com/docs/replay-vision/creating-scanners)
