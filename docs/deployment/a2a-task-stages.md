# A2A response-stage observations

Known hosted SendMessage execution, catalogue setup and native-trial dispatches
add `metadata.task_progress` to their task result:

```json
{
  "version": 1,
  "stage": "routing",
  "evaluation_performed": false,
  "scope": "response_stage_only",
  "human_review_required": true
}
```

| Stage | Meaning | evaluation_performed |
|---|---|---|
| setup | Read-only catalogue, trial status/feedback or utility response | false |
| routing | Orientation or next-step plan only | false |
| input_required | Execution asks for missing input | false |
| evaluation_completed | A known evaluation dispatch completed | true |
| failed | Instrumented dispatch failed/refused | null |
| unmeasured | Dispatch does not establish an evaluation stage | null |

The stamp is server-derived, never copied from caller metadata or inferred from
HTTP 200. A completed evaluation can still report adverse findings, REVIEW or
BLOCK. It is not factual truth, action authorization, payment or human acceptance.

Each instrumented response emits one `agenda_intelligence_a2a_funnel` event with
`event_version=7`, `step=a2a_task_stage`, `task_stage_version=1`, finite
`agent_profile`, `a2a_stage`, matching `evaluation_performed` and `http_status`.
Existing origin/owner/probe classification remains separate. No task IDs,
filenames, excerpts, input text or findings are added to the stage event.
Telemetry failure cannot change admission or cause an evaluation retry.

Coverage is a lower bound: authentication, malformed protocol, quotas/payment
admission before dispatch and some storage failures may have no stage event.
GetTask replays do not emit another event for a prior evaluation. Missing legacy
instrumentation stays unmeasured; old HTTP successes are never backfilled into
evaluations. Event counts are not unique people, tasks or conversion. Keep stage
counts separate from usage, payments and durable trial-completion reconciliation.
Existing request schemas, admission and response outcome contracts remain intact.
