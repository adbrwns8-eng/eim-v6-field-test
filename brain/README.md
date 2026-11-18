# BRAIN-001 — isolated scheduled runner pilot

This is a **dry-run scaffold**, not an autonomous coding agent. It processes at most one approved zero-cost queue item, runs unit tests and produces a JSON audit artifact. No API calls, no GitHub writes, no PR creation, no secrets, and no deployments.

## Safety boundaries
- Workflow token is `contents: read` only; checkout does not persist credentials.
- No OpenAI secret is referenced or required. Do **not** add it yet.
- Queue schema is deliberately fail-closed: an approved non-dry-run or paid task causes the run to fail.
- The schedule is inert while this workflow exists only on a draft branch; merging to main would enable scheduled runs **and trigger the existing Pages deployment**, so **do not merge** until the independent release-security review approves the entire release.
- GitHub cron is UTC and may be delayed; the current example targets 10 PM in standard time, 11 PM in daylight time.
- GitHub Actions minutes and artifact storage can have separate billing/quotas. This pilot makes zero OpenAI API calls.

## Validation
Run `python3 -m unittest discover -s brain/tests -v` and `python3 brain/runner.py --queue brain/tasks.json --report brain-report.json` locally. No external dependencies.

## Next gated milestone
After independent review, implement isolated execution for approved engineering tasks, secure secret handling, durable atomic budget ledger, preflight token-price reservations, explicit kill switch, failure handling, code-review-only draft PR permissions, and independent deployment authorization. A nominal $1/task or $5 total budget is not a hard cap until those mechanisms are tested.
