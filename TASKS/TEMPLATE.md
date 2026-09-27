# Shared task envelope pointer

Use the [canonical product policy pointer](../docs/CONTROL_PLANE_POINTER.md) and
`.github/control-plane-client.json` to resolve the exact central commit.
At that commit read `engineering/TASKS/TEMPLATE.md` and
`engineering/projects/maeum-gyeol.md` for the task shape and project defaults.
Keep the canonical task in its GitHub issue; do not duplicate the shared template here.

Product-specific rules in `AGENTS.md` and approved product contracts remain mandatory.
This compatibility pointer does not install or enable a dispatcher, change host
settings, or transfer historical audit/activation evidence. Preserve task/owner/
request identities and reconcile/fence unresolved launches before any cutover.
User-only merge; no automatic fallback, retries, polling or standing routines.
