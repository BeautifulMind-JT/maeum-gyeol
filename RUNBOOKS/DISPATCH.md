# DISPATCH RUNBOOK v2

This is a deterministic execution contract.
Grok does not extend it mid-session.

NO STANDING ROUTINES.
NO POLLING.
NO BACKGROUND MONITORING.
NO SECOND SEMANTIC REASONING PASS.

## 1. Project map

PROJECT: MAEUM_GYEOL
REPO: `BeautifulMind-JT/maeum-gyeol`
DEFAULT_BRANCH: `main`
SLACK_PROJECT: `#maeum`
SLACK_CONTROL: `#ai-control`
SLACK_DECISIONS: `#ai-decisions`
SLACK_AUDIT: `#ai-audit`

DEFAULT_EXECUTION_CLASS: `DEVIN_STANDARD`
DEFAULT_AUDIT_FLOOR: `A1`
REVIEW_POLICY: `REQUIRED_NON_A0`
REVIEWER_LANE_ID: `CONFIG_REQUIRED`

TASK_SPEC_POLICY: `BLUEPRINT_AND_CANONICAL_ISSUE`
A0_POLICY: `EXPLICIT_AUTHORIZATION_ONLY`
POST_MERGE_POLICY: `NONE_UNLESS_REPO_RULE_REQUIRES`

Substantive work must point to `README.md`, `docs/BLUEPRINT.md`, and the
applicable release/implementation document.

Auth/RLS, private-original/public-copy separation, server drafts,
idempotency/retry/response-loss recovery, storage/photo privacy, deletion and
migration rules remain authoritative.

Implementing an existing RLS/security policy is A2-capable work inside approved
boundaries. Changing who may read/write data or changing an authority/privacy
boundary is a consequential contract change and requires pre-implementation
Astra analysis + User decision (A3/authority boundary).

If PROJECT MAP or required actor/reviewer configuration is missing:
`[BLOCKED] Reason: CONTROL_PLANE_NOT_CONFIGURED`

Do not guess.

## 2. Activation preconditions

Before automation is enabled, the mechanical layer must have:

- configured USER actor identity;
- configured ASTRA actor identity;
- configured Grok/router identity;
- configured Devin/provider identity;
- configured independent reviewer identity/lane;
- per-TASK_KEY single-writer serialization;
- canonical-control-record read/write support;
- self-event filtering;
- provider launch reconciliation or explicit UNKNOWN handling.

Until these exist, these documents are policy only; they do not prove runtime
enforcement.

## 3. Raw event intake

Allowed raw sources:

1. explicit authenticated USER command;
2. configured Slack workflow/command;
3. GitHub webhook / GitHub Actions event;
4. configured worker/reviewer/provider callback;
5. configured ASTRA audit result channel/action.

The mechanical layer rejects:

- unconfigured actors;
- ordinary chat text masquerading as PASS/DECISION;
- router's own status messages as new task triggers;
- events that cannot be mapped to one canonical task;
- duplicate delivery IDs already recorded with the same effect.

A free-form User request without a canonical task record is an intake request,
not a dispatch event. A cheap deterministic intake form/workflow must first
create or identify the canonical GitHub task and task revision.

## 4. Normalized event contract

Only normalized events may invoke Grok.

Every normalized event contains:

EVENT_ID:
EVENT_TYPE:
SOURCE_ACTOR_ID:
SOURCE_POINTER:
REPO:
TASK_ID:
TASK_REVISION:
CANONICAL_TASK_POINTER:
CONTROL_RECORD_POINTER:
ATTEMPT_ID:
PR_POINTER:
HEAD_SHA:
RUN_OR_RESULT_ID:

Fields that do not apply are explicit `N/A`; they are not silently omitted.

Result/gate events that refer to code must carry HEAD_SHA.
Decision events must carry TASK_REVISION and durable decision pointer.

## 5. TASK_KEY and canonical control record

`TASK_KEY = REPO + TASK_ID`

Each TASK_KEY has exactly one canonical control record, durably projected in
the canonical GitHub task/issue at a fixed machine-owned record pointer.

The GitHub projection is durable evidence, not the serialization primitive.

Control record minimum facts:

- TASK_KEY
- TASK_REVISION
- canonical task/spec pointer
- CLAIM_ID
- CLAIM_STATE
- LAUNCH_REQUEST_ID
- LAUNCH_STATE
- ATTEMPT_ID
- OWNER_WORKER
- OWNER_SESSION_ID
- PR_POINTER
- CURRENT_HEAD_SHA
- verification policy and current-head verification facts
- review policy, reviewer lane/session and current-head result
- audit floor, verified audit depth, audited SHA/evidence SHA and result
- unresolved blocker/decision pointer
- merge SHA
- post-merge result/follow-up pointer
- last accepted event IDs

State is derived from these facts. Arrival order does not blindly overwrite
state.

## 6. Per-task serialization

All mutations of one control record occur under a single-writer serialization
primitive keyed by TASK_KEY.

Two concurrent events for the same task must not both observe "unowned" and
launch two writers.

EVENT_ID deduplicates delivery.
TASK_KEY serialization protects job ownership.

Both are required.

## 7. Claim and launch protocol

### Existing owner

If OWNER_SESSION_ID exists:
- do not create a new writer;
- route eligible feedback to that owner;
- record the new EVENT_ID as observed;
- end.

### New owner claim

Under TASK_KEY serialization, if there is no owner and no unresolved launch:

1. create CLAIM_ID;
2. set CLAIM_STATE=`CLAIMED`;
3. create stable LAUNCH_REQUEST_ID;
4. set LAUNCH_STATE=`NOT_STARTED`;
5. persist the control record;
6. emit normalized `DISPATCH_ALLOWED`.

Only the designated launch executor may continue that claim.

### Launch outcome

Grok launches exactly the designated worker and returns a receipt with the same
CLAIM_ID and LAUNCH_REQUEST_ID.

If provider launch is confirmed:
- set LAUNCH_STATE=`CONFIRMED`;
- record OWNER_SESSION_ID / OWNER_WORKER / ATTEMPT_ID.

If provider proves no session was created:
- set LAUNCH_STATE=`FAILED_PRESTART`;
- retry only through an explicit retry rule/event.

If launch may have succeeded but outcome is ambiguous:
- set LAUNCH_STATE=`UNKNOWN`;
- do not auto-relaunch;
- reconcile by LAUNCH_REQUEST_ID/provider evidence, or require User resolution.

If crash occurred after claim but record proves NOT_STARTED, resume that exact
claim/request. Do not create a new claim.

## 8. Manual dispatch during Grok outage

Caller/mechanical layer records Grok quota/outage.

Manual dispatch is forbidden when:

- OWNER_SESSION_ID exists;
- LAUNCH_STATE=`UNKNOWN`;
- another active claim belongs to a different executor.

A mechanical `MANUAL_CLAIM_ALLOWED` action reserves the existing task before
User launches Devin manually. The resulting provider session ID is written
back to the same control record.

No replacement AI dispatcher is appointed.

## 9. Task-envelope use

Grok reads `TASKS/TEMPLATE.md` from the canonical task record.

Grok does not create a second task spec, paraphrase objectives, infer omitted
contracts/invariants, or semantically choose execution class/audit depth.

Missing EXECUTION_CLASS defaults to DEVIN_STANDARD.
A0/CHEAP requires explicit A0 authorization.

## 10. Writer autonomy and feedback

Feedback always returns to the same OWNER_SESSION_ID.
CI/review/audit failures do not create a new writer.

Devin owns ordinary implementation/debug/test choices inside approved
boundaries.

`STALLED` must be explicitly reported by Devin/provider.
`BUDGET_LIMIT_REACHED` may be emitted only by a configured mechanical cost
guard.

## 11. HEAD and task-revision guards

Code-result events are accepted only when HEAD_SHA equals CURRENT_HEAD_SHA,
except accepted HEAD_CHANGED that advances CURRENT_HEAD_SHA.

On HEAD_CHANGED:

- update CURRENT_HEAD_SHA;
- clear current-head verification facts;
- clear current-head review facts;
- clear current-head audit facts;
- retain old results only as history.

Late old-HEAD results never advance gates.

If a consequential decision changes task scope/contract:
- persist decision;
- increment TASK_REVISION;
- update authoritative task/spec pointer;
- invalidate older revision approvals as applicable;
- then resume.

## 12. Verification gate

A single successful check is never CI_GATE_PASS.

MAEUM_GYEOL verification policy is `CI_REQUIRED`.

For each CURRENT_HEAD_SHA the GitHub Actions workflow
`M0 reproducibility` must complete successfully.

Older-SHA success is stale. CI success is not equivalent to M1/M2 real-use
validation or production deployment approval.

Accepted facts include exact HEAD SHA and run ID.

Failure:
- update current-head verification facts;
- emit one normalized failure transition;
- Grok relays exact failure pointer to the same owner;
- Grok does not debug.

Repeated identical raw check events do not repeatedly wake Grok unless gate
state materially changes.

## 13. Independent review gate

All non-A0 substantive work requires independent read-only review before Astra
audit.

After verification success, mechanical layer emits REVIEW_DISPATCH_ALLOWED if
no current-head review exists.

Grok launches configured REVIEWER_LANE_ID read-only and ends.

If reviewer lane unavailable:
`BLOCKED_REVIEW_LANE`

No silent skip.

Accepted review result requires configured reviewer actor, matching task
revision, matching current HEAD/evidence SHA and matching review attempt/session.

FAIL returns exact findings to the same writer.
New HEAD invalidates old review.
PASS records current-head result and emits AUDIT_REQUIRED.

## 14. Astra audit gate

Audit packet contains:

Project:
Task:
Task revision:
Repository:
PR/evidence pointer:
Base SHA:
Current HEAD/evidence SHA:
Objective/task-spec pointers:
Authoritative document pointers:
Verification facts:
Independent review facts:
Worker-reported touched areas:
Worker-reported contract-change flag:
Audit floor:

Astra independently reads actual diff/evidence and authoritative docs.

Required result fields:

AUDIT_RESULT: PASS | PASS_WITH_NOTES | FAIL | DECISION_REQUIRED
AUDITED_TASK_REVISION:
AUDITED_HEAD_OR_EVIDENCE_SHA:
VERIFIED_AUDIT_DEPTH:
VERIFIED_TOUCHED_AREAS:
VERIFIED_CONTRACT_CHANGE_REQUIRED:
FINDING_POINTERS:

Mechanical layer accepts only configured ASTRA actor and current revision/SHA.

FAIL returns exact findings to the same writer.
DECISION_REQUIRED records blocker and emits the decision request.

## 15. Consequential decision gate

Decision request contains task/revision, blocking question, current
authoritative rule and exact evidence pointers.

Grok adds no preferred option.

Only configured User decision events authorize a choice.
Decision must be durable in GitHub/ADR/task authority before
DECISION_RECORDED.

Ordinary Slack text is not a decision event.

## 16. A0 final qualification

A0 requires explicit authorization plus project-specific objective checks,
including forbidden/locked/sensitive paths.

If qualification fails:
promote to A1 → independent review → Astra audit.

A0 never bypasses repository-specific validation/bookkeeping.

## 17. Derived states

RECEIVED
CLAIMED
LAUNCH_UNKNOWN
RUNNING
BLOCKED
STALLED
BUDGET_BLOCKED
PR_OPEN
VERIFICATION_FAILED
READY_FOR_REVIEW
REVIEW_RUNNING
REVIEW_FAILED
BLOCKED_REVIEW_LANE
READY_FOR_AUDIT
AUDIT_RUNNING
AUDIT_FAILED
DECISION_REQUIRED
READY_FOR_MERGE
MERGED_POST_VERIFY
POST_MERGE_FAILED
DONE
DONE_NO_CHANGE

State is derived from control-record facts, not event arrival order.

Unresolved blocker/decision outranks progress.
LAUNCH_UNKNOWN blocks new launch.
Current revision/head must match all gates.
READY_FOR_MERGE is computed, never accepted from arbitrary text.

## 18. READY_FOR_MERGE predicate

All must be true:

- PR open and CURRENT_HEAD_SHA equals PR head;
- task revision current;
- no unresolved blocker/decision;
- M0 reproducibility gate satisfied for current HEAD;
- independent review PASS for current HEAD;
- Astra PASS/PASS_WITH_NOTES for current task revision and HEAD;
- VERIFIED_AUDIT_DEPTH satisfies task floor and Astra-verified touched areas;
- VERIFIED_CONTRACT_CHANGE_REQUIRED is NO, or required User decision is
  durably recorded and reflected in current task revision;
- project-specific merge prerequisites satisfied.

User still decides merge.

## 19. No-change / non-code completion

NO_CHANGE requires DELIVERABLE_MODE authorization.

For A1+ NO_CHANGE:
- exact evidence/base SHA;
- independent review of evidence;
- Astra audit of no-change conclusion;
- PASS may derive DONE_NO_CHANGE;
- no merge is invented.

NON_CODE_EVIDENCE follows project-specific content/privacy/release approval;
engineering gates do not substitute for those approvals.

## 20. Merge and DONE

No generic post-merge verification is added by this control plane.

Repository-specific release/deployment/real-use validation remains separate.

If no task/repository post-merge gate applies, authenticated PR_MERGED may
derive DONE.

Grok never merges.

## 21. Grok normalized actions

| Event | One action |
|---|---|
| DISPATCH_ALLOWED | launch designated writer; return receipt; end |
| WRITER_FEEDBACK_REQUIRED | relay exact pointer to existing owner; end |
| REVIEW_DISPATCH_ALLOWED | launch read-only reviewer; return receipt; end |
| AUDIT_REQUIRED | post exact audit packet to #ai-audit; end |
| DECISION_REQUIRED | post exact decision packet to #ai-decisions; end |
| BLOCKED_STATUS | post short fields-only status; end |
| READY_FOR_MERGE | post fields-only status; end |
| DONE / DONE_NO_CHANGE | post fields-only status; end |

All gate aggregation/state derivation is mechanical-layer work.

## 22. Slack

`#ai-control` — explicit control/status
`#ai-decisions` — authenticated User/Astra decisions
`#ai-audit` — authenticated Astra audit
`#maeum` — project task/status cockpit

One task → one thread.
Do not feed all Slack messages to Grok.
Only explicit commands or normalized workflow events invoke Grok.

Slack decisions/audits are not durable until GitHub record/pointer exists.

## 23. Credentials

- Grok: repo/PR/check read + narrow task comment/status relay; no source write,
  PR create, admin, secrets, delete, merge.
- Devin: assigned repo/task branch/PR; no merge/admin.
- Cheap writer: assigned task/branch only.
- Reviewer: read + finding comment; no source write.
- Astra: read + audit/decision evidence only; no source write/merge.
- Mechanical layer: control-record/claim/status mutation only; no source
  write/merge.
- User: final authority.

Actual token/app enforcement must be separately verified before claiming these
permissions are technically enforced.

## 24. Cost discipline

Mechanical layer deduplicates raw repeats before Grok.
Only state transitions requiring routing wake Grok.
Matrix/check chatter does not wake Grok check-by-check.
Grok never waits and never polls.
