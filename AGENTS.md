# Product agent governance

Shared engineering policy is maintained in `BeautifulMind-JT/ai-ops-control-plane`.
See `docs/CONTROL_PLANE_POINTER.md` and `.github/control-plane-client.json` for
the candidate pin, pending central PR acceptance. Policy adoption is not runtime
activation. User-only merge, non-author exact-HEAD review, single writer, UNKNOWN
fencing, no polling and no automatic retry remain required.
If shared policy and project contracts conflict, stop with DECISION_REQUIRED.

## Repository-specific engineering constraints

Read `README.md`, `docs/BLUEPRINT.md`, and applicable release/implementation
documents before substantive work.

Existing Auth/RLS, private/public record separation, server draft,
idempotency/retry/response-loss recovery, storage/privacy, deletion and
migration contracts remain authoritative. Implementing the approved policy is
distinct from changing the policy or authority boundary.
