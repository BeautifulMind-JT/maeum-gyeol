# DISPATCH RUNBOOK v3

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

OPERATING_MODE: `MANUAL_ONLY`
AUTOMATED_ACTION_ADAPTER: `MECHANICAL`
GROK_EVENT_OVERRIDES: `NONE`

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
- configured action-adapter identities (Grok only for explicit overrides);
- configured Devin/provider identity;
- configured independent reviewer identity/lane;
- per-TASK_KEY single-writer serialization;
- canonical-control-record read/write support;
- self-event filtering;
- provider launch reconciliation or explicit UNKNOWN handling.

The implementation must receive an independent exact-SHA audit and explicit
User activation after these checks. Documentation approval does not enable it.
Until then the manual protocol in section 8 applies.

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
- CANONICAL_SLACK_THREAD (N/A until linked)
- CONTROL_RECORD_VERSION and pending action/delivery IDs
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
- review policy, REVIEW_REQUEST_ID, REVIEW_LAUNCH_STATE, reviewer lane/session,
  review attempt ID and current-head result
- audit floor, AUDIT_REQUEST_ID, AUDIT_REQUEST_STATE, verified audit depth,
  audited SHA/evidence SHA and result
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

Under TASK_KEY serialization:
- Existing active owner: relay eligible feedback to that owner; never launch another.
- Existing unresolved claim/request: reuse it; never create a competing claim.
- Otherwise persist CLAIM_ID, designated executor, stable LAUNCH_REQUEST_ID,
  LAUNCH_STATE=NOT_STARTED and a durable pending dispatch action together.

Before any external launch, atomically consume that action and persist
LAUNCH_STATE=SUBMITTING. Only the executor holding that permission may send.
NOT_STARTED therefore proves no send was authorized; resume only the same request.
SUBMITTING after a crash is potentially sent: reconcile or mark UNKNOWN; never
automatically launch again. Timeout/claim expiry alone does not authorize takeover.

Use LAUNCH_REQUEST_ID as the provider idempotency key when supported.
Confirmed receipt records CONFIRMED + OWNER_SESSION_ID + worker/attempt.
Provider proof of no session permits FAILED_PRESTART; a configured retry event
may reauthorize that same task only after the prior executor is fenced.
Ambiguous outcome records UNKNOWN and blocks relaunch until provider evidence
or explicit User resolution proves the safe next step. Slack response loss
never undoes a confirmed GitHub owner record.

State mutation and pending-action persistence must be atomic in the serialized
store. GitHub holds the durable projection; projection failure blocks further
launches until reconciled. Pending NOT_STARTED actions may be resumed by an
explicit recovery event, not polling. This is not a claim of exactly-once
external execution.

## 8. Manual dispatch and outage

OPERATING_MODE=MANUAL_ONLY until the activation gate passes. All automatic
dispatchers are disabled. User is the sole launch executor and control-record
writer in this mode; a comment alone is not a concurrent lock.

Before direct User -> Devin dispatch:
1. identify canonical task/revision and existing owner/request;
2. reuse an active owner; block if any unresolved SUBMITTING/UNKNOWN request exists;
3. durably reserve CLAIM_ID/LAUNCH_REQUEST_ID and record SUBMITTING before launch;
4. send only the task pointer/revision and record the resulting session ID.
If the GitHub reservation cannot be recorded, do not launch. Response loss
requires reconciliation, not a second session. Do not enable automation while
a manual claim/send is unresolved.

In automated mode manual dispatch requires a serialized MANUAL_CLAIM_ALLOWED
action and the same launch protocol. Outage does not bypass ownership.
The caller records and projects Grok quota failure itself. No replacement AI
dispatcher is appointed; recovery requires an explicit event/User action.

## 9. Task-envelope use

Grok reads `TASKS/TEMPLATE.md` from the canonical task record.

Grok does not create a second task spec, paraphrase objectives, infer omitted
contracts/invariants, or semantically choose execution class/audit depth.

Missing EXECUTION_CLASS defaults to DEVIN_STANDARD.
A0/CHEAP requires explicit A0 authorization.

## 10. Writer autonomy and feedback

No routine Astra preflight, plan approval or progress review is required for
an already authorized task. Devin investigates and selects implementation
within approved contracts. CI failure has no arbitrary two-attempt cutoff.

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

HEAD_CHANGED is accepted only after reading the live PR head under task
serialization; delayed events cannot restore an old head. PR_OPEN may bind
the authenticated owner's PR before DEVIN_DONE arrives. All result events
must match TASK_REVISION and the current request/run attempt, not only SHA.
A merged/terminal task cannot resume its writer from late pre-merge events.
Post-merge verification uses MERGE_SHA and the post-merge phase, not PR HEAD.

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
- The configured adapter relays exact failure pointer to the same owner;
- Grok does not debug.

Repeated identical raw check events do not repeatedly wake Grok unless gate
state materially changes.

## 13. Independent review gate

Reviewer sends use the same NOT_STARTED -> SUBMITTING -> CONFIRMED/UNKNOWN
protocol as writer launches, keyed by REVIEW_REQUEST_ID/REVIEW_ATTEMPT_ID.
Persist the pending action with the request; a crash is not permission to resend.

Review dispatch is itself idempotent and serialized.

Under TASK_KEY serialization, before emitting a review request for the current
task revision + HEAD/evidence SHA:

1. if a matching review PASS/FAIL already exists, do not launch another reviewer;
2. if a matching REVIEW_REQUEST_ID/session already exists, reuse it;
3. otherwise create stable REVIEW_REQUEST_ID and REVIEW_ATTEMPT_ID;
4. set REVIEW_LAUNCH_STATE=`NOT_STARTED`;
5. persist the control record;
6. emit exactly one `REVIEW_DISPATCH_ALLOWED`.

The configured adapter returns a review-launch receipt keyed by REVIEW_REQUEST_ID.

Confirmed reviewer launch records the reviewer session and
REVIEW_LAUNCH_STATE=`CONFIRMED`.

If reviewer launch may have succeeded but the outcome is ambiguous:
REVIEW_LAUNCH_STATE=`UNKNOWN`.
Do not auto-launch another reviewer. Reconcile the existing request or require
User resolution.

All non-A0 substantive work requires independent read-only review before Astra
audit.

After verification success, mechanical layer emits REVIEW_DISPATCH_ALLOWED if
no current-head review exists.

The configured adapter launches configured REVIEWER_LANE_ID read-only and ends.

If reviewer lane unavailable:
`BLOCKED_REVIEW_LANE`

No silent skip.

Accepted review result requires configured reviewer actor, matching task
revision, matching current HEAD/evidence SHA and matching review attempt/session.

FAIL returns exact findings to the same writer.
New HEAD invalidates old review.
PASS records current-head result and emits AUDIT_REQUIRED.

## 14. Astra audit gate

Audit-request delivery is also serialized by task revision + current
HEAD/evidence SHA.

Before emitting `AUDIT_REQUIRED`, the mechanical layer:

1. reuses an existing accepted audit result for that exact revision/SHA only;
2. if a matching AUDIT_REQUEST_ID is already REQUESTED/DELIVERED/UNKNOWN, does not
   create a second request;
3. otherwise creates stable AUDIT_REQUEST_ID, sets
   AUDIT_REQUEST_STATE=`REQUESTED`, atomically persists the pending delivery,
   then emits one request. Before sending, persist SUBMITTING; a crash or lost
   response blocks resending until reconciled. Include SUBMITTING in dedupe.

If audit-request delivery outcome is ambiguous:
AUDIT_REQUEST_STATE=`UNKNOWN`.
Do not blindly repost. Reconcile the existing request or require User action.

Audit packet contains:

AUDIT_REQUEST_ID:
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

AUDIT_REQUEST_ID:
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

Audit results must also match the outstanding AUDIT_REQUEST_ID.
Re-audit starts with the prior audited SHA delta and unresolved findings,
checks affected dependencies/contracts, then issues a new current-SHA result.
A writer evidence index is navigation, never an independent proof.

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

Path checks alone do not prove A0 semantics. Final A0 qualification also
requires an authenticated User attestation of typo/format-only changes for
the exact revision/HEAD, or an approved deterministic transform verifier.
Otherwise promote to A1. For qualified A0 only, Astra audit and separate
review are N/A unless repository rules require them; section 18 audit/depth
predicates apply to A1+. All verification/blocker/merge gates still apply.

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

## 21. Fixed action ownership

ACTION_ADAPTER is configured per event below, not selected by Grok.
Automation defaults to MECHANICAL for every row. A User-approved explicit
mapping may select GROK for a limited launch/relay action; never both.
No configuration silently falls back to another AI on error.

| Normalized event | Action | Default adapter |
|---|---|---|
| DISPATCH_ALLOWED | launch designated owner using section 7; record receipt | MECHANICAL |
| WRITER_FEEDBACK_REQUIRED | exact pointer to existing owner | MECHANICAL |
| REVIEW_DISPATCH_ALLOWED | launch configured read-only reviewer | MECHANICAL |
| AUDIT_REQUIRED | exact audit packet to #ai-audit | MECHANICAL |
| DECISION_REQUIRED | exact decision packet to #ai-decisions | MECHANICAL |
| BLOCKED_STATUS | durable blocker + short status/Human action | MECHANICAL |
| READY_FOR_MERGE | project-thread notification only | MECHANICAL |
| DONE / DONE_NO_CHANGE | project-thread final pointers | MECHANICAL |

When explicitly mapped to GROK: one normalized event, one authorized action,
one receipt, end session. State mutation/aggregation stays mechanical.
In MANUAL_ONLY mode User performs delivery with the same durable facts.

## 22. Slack

`#ai-control` — explicit control/status
`#ai-decisions` — authenticated User/Astra decisions
`#ai-audit` — authenticated Astra audit
`#maeum` — project task/status cockpit

One task → one canonical thread. GitHub task and Slack thread link both ways.
Project statuses are projections of the durable control record, keyed by
CONTROL_RECORD_VERSION; old/repeated projections are suppressed.
Fields: task/revision, state, owner/session, PR/HEAD, verification/review/audit,
blocker pointer, required Human action. Long context stays behind GitHub pointers.
Astra attention is #ai-decisions/#ai-audit, never the project-channel firehose.
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

Deduplicate raw events and aggregate CI matrices before any AI invocation.
Unchanged state does not produce another status, review or audit request.
Astra receives decision questions or gate-ready evidence, not progress chatter.
Devin owns repository investigation and the entire test/fix loop.
No polling, standing sessions or transcript surveillance.
Measure per-completed-task agent cost, Astra usage, User interventions and
audit rework; report unavailable usage metrics as unknown.

