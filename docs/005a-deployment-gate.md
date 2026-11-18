# BOS Issue #5 — Assignment 005A: manual Pages release gate

**Draft implementation only. No merge or release authorization.** No workflow was
dispatched, no deployment was made, and no repository/environment setting was
changed. The current live controls fail this proposed policy: releases must remain
blocked until the owner independently resolves the prerequisites below.

## Verified starting point and reconciliation

On 2026-11-18, `git fetch origin main` and an independent
`git ls-remote origin refs/heads/main` both resolved to
`45a61c83aac0ad521046bcad9a04ed8e8cc35193`. Branch
`bos/005a-deployment-gate` starts at that commit, not at the existing browser-test
branch. No unrelated branch was cherry-picked.

- Draft PR #3, `3349387074b7ca38e870769d54bf2a34f87ff607`, supplies PR-only CI and
  context-wide browser network isolation. It is not on main. Its exact required
  check is `Synthetic npm and browser tests`. This PR does not duplicate its
  browser/application changes; it adds a separate deployment-policy check.
- Draft PR #4, `fe59dbd234bab258f424f70a4b92dbbbe16123f3`, is proposal-only.
  Its safety goals informed this implementation; its historical settings claims
  were checked against live read-only GitHub API responses.
- The fetched main has only the automatic/manual `.github/workflows/pages.yml`,
  with broad workflow-level Pages/OIDC write permissions and whole-checkout upload.
  That deployed/default-branch configuration is unchanged by opening this draft.

### Live metadata observed (not a deployment test)

| Control | Observation | Consequence |
| --- | --- | --- |
| Pages source | `build_type: workflow`; source metadata still mentions main `/` | Actions publishing selected; source metadata alone is not evidence of active legacy publishing |
| Environment | `github-pages`, sole reviewer `adbrwns8-eng` | Designated owner review exists |
| Self-review | `prevent_self_review: false` | Unsafe; proposed gate rejects |
| Environment admin bypass | `can_admins_bypass: false` | Desired setting observed |
| Deployment branch policies | Exactly branch `main`, no tags | Desired restriction observed |
| Main ruleset | Active `27423765`, no bypass actors, deletion/non-fast-forward blocked | Desired protections observed |
| PR review | One approval, stale reviews dismissed, resolved conversations required | Present, but latest-push and code-owner requirements are false |
| Required checks | Strict `Synthetic npm and browser tests` from GitHub Actions (integration 15368) | Workflow remains in unmerged PR #3; resolve availability before merge |
| Registered active workflows | Pages, PR CI, and `dynamic/pages/pages-build-deployment` | Unknown legacy entry must be investigated; proposed gate rejects it |

No production site or Supabase endpoint was contacted. API reads above concerned
repository/PR/Actions/environment metadata only, using existing injected platform
authentication without displaying or storing credential values.

## Implemented controls

1. **Manual main only.** The sole release event is `workflow_dispatch`, requiring
   `approved_sha`. Both jobs and the runtime policy reject other events, non-main
   refs, a foreign repository/workflow, and reruns. A retry requires a fresh
   dispatch and a fresh environment approval, not reuse of a prior job approval.
2. **Exact commit.** Reject abbreviations, tags, branch names, whitespace, uppercase,
   newlines and shell/expression strings. Resolve the full lowercase 40-character
   commit through GitHub; require its exact SHA and ancestry on dispatch-time main.
   Require current main to equal the immutable workflow SHA before/after metadata
   checks and again after human approval. Movement means start over, not silently
   upgrade the approved target. A reviewed ancestor can be selected deliberately.
3. **Immutable artifact.** Read an explicit 16-file frontend allowlist directly from
   the approved commit's Git blobs. Do not execute that revision's code. Reject
   missing/nonregular/executable/symlink assets. Create a deterministic Pages tar
   and manifest containing the approved SHA plus every file's SHA-256. Exclude
   dependencies, tests, backend SQL/functions, `.git`, `.github`, and arbitrary
   checkout files. Adding a frontend asset requires a reviewed allowlist change.
4. **Bound identity.** Use an immutable upload-v4 artifact, unique run/attempt/SHA
   name, exact artifact ID and SHA-256 zip digest from upload outputs. After approval,
   verify its ID/name/run/source-workflow-SHA/digest/expiry, download by ID, and
   verify the tar's manifest digest, revision, file allowlist and all file hashes
   without extracting or executing it. Reject extra/duplicate/traversal paths,
   links, special files and oversized entries.
5. **No name re-resolution.** A final revalidation precedes OIDC acquisition. The
   Pages API receives the verified artifact ID and the approved revision directly.
   This avoids `deploy-pages` performing another name lookup after our validation.
   The API request shape/status polling follows the reviewed official
   `actions/deploy-pages` v4.0.5 source; that action is not executed or embedded.
   The helper never logs OIDC/request bodies and sanitizes API errors. It does not
   retry creation; status polling is bounded and errors fail the job.
6. **Human gate.** The `deploy` job targets `github-pages`. The runtime policy
   additionally requires self-review prevention, no admin bypass, exactly the
   designated human owner as required reviewer, a different initiator/rerun actor,
   main-only branch policy, strict required checks, current code-owner review,
   no ruleset bypass, Actions-only Pages and a closed active-workflow inventory.
   Unknown/inaccessible settings fail closed. No API error produces an allow result.
7. **Least privilege.** Workflow default permissions are `{}`. Preparation receives
   only `contents: read` and `actions: read`. Only the protected deploy job adds
   `pages: write` and `id-token: write`; its read permissions support trusted-control
   checkout and verification. No PR job receives deployment permissions, environment
   access or production secrets. Checkout never persists credentials. No settings
   configuration action, reusable deployment workflow, automatic push, or PR deployment
   trigger is included. All direct external actions are pinned to full upstream SHAs.
8. **Workflow integrity.** CODEOWNERS assigns release/CI controls, tests and manifests
   to the owner. New PR-only read-only CI runs offline policy/artifact tests. It does
   not dispatch or test a real release. Concurrency serializes Pages releases without
   cancelling an in-progress approved release.

## Owner-operated prerequisites — NOT performed by this task

Before any merge, independently review this draft and PR #3/#4, reconcile any
updated revisions, and resolve the currently-required CI check availability. Do not
disable a required check or review rule to get this PR merged. In particular:

- Establish a development/release initiator identity separate from `adbrwns8-eng`.
  An owner-authored PR cannot receive that owner's own code-owner approval. Resolve
  reviewer governance before enabling additional rules; do not create a single-owner
  approval deadlock or lend the agent the human approval identity.
- After its workflow is reviewed/available and verified, require
  `Deployment gate synthetic security tests` in addition to PR #3's
  `Synthetic npm and browser tests`, both from GitHub Actions integration 15368,
  with strict up-to-date checks. Confirm the PR check can actually be emitted.
- Require current code-owner and latest-push approval, dismiss stale approvals,
  resolve discussions, and forbid force-push/deletion and all bypass actors.
  Protect `.github`, release scripts, tests and lockfiles through CODEOWNERS and
  effective enforcement, not merely this documentation.
- On `github-pages`, enable prevention of self-review, retain the sole designated
  human owner reviewer, disable administrator bypass, and retain only the main
  branch deployment policy. The initiator must differ from that reviewer. Changing
  the designated approval model requires an explicitly reviewed policy change.
- Confirm Actions-only publishing. Investigate the active dynamic Pages entry;
  remove/retire any alternate publishing route under separate authorization. Do not
  merely add the historical entry to the allowlist. Review other environments,
  reusable workflows, Apps/tokens, administrators and external publishing services.
  The closed workflow inventory is a rejection mechanism, not proof that an
  administrator or external credential cannot publish elsewhere.
- Keep coding-agent access to the human approval account, environment secrets,
  production credentials, administration and deployment operations unavailable.
  Verify effective identity separation; a prompt is not an access-control boundary.
- Independently verify the job-scoped `GITHUB_TOKEN` can read every required public
  metadata endpoint with the declared read permissions. This cloud session's token
  is not a workflow token, so successful cloud metadata reads do not prove this.
  A missing capability blocks release. Do not add a PAT, broad administration scope,
  production secret, anonymous fallback or skipped check to make the gate pass.
  If the platform cannot supply the necessary least-privilege reads, stop and design
  a separately authorized owner-controlled release boundary.
- In a separately authorized nonproduction exercise, verify real approval behavior,
  artifact/API compatibility and failure paths before authorizing any first release.
  No such exercise, workflow dispatch or production validation occurred here.

### Future human release review (description only; not authorization)

The owner verifies the selected main commit, reviewed workflow revision, required
checks and frontend diff, then separately authorizes a main-ref manual run initiated
by the distinct release operator. Before approving the environment, inspect the
prepare job's summary: approved frontend SHA, control-workflow SHA, artifact ID,
artifact digest and manifest digest. Approval is for those immutable identifiers,
not for whatever main contains later. If anything changes or a check is unreadable,
stop. No agent may approve its own deployment. Never approve an old rerun.

## Synthetic validation

Node 24.22.1, Python 3 standard library. No live service requests, real OIDC minting,
Pages deployment calls or employee records are used by the test suites.

- `npm ci --ignore-scripts --cache /workspace/.npm-cache --no-audit --no-fund`:
  locked dependency installation; YAML parser is an exact dev-only pin for actual
  workflow parsing, not a production dependency.
- `npm run test:deployment-gate`: **84 Node tests and 10 Python artifact tests
  passed, none skipped or failed**. Policy/workflow mutation tests and synthetic API
  responses; artifact integrity tests use fabricated tar files and a temporary Git
  repository. Includes rejection of bad SHA/event/ref/settings, main races, unknown
  APIs/workflows, privilege escalation, skipped checks, artifact substitution, archive
  tampering, OIDC/API failures and bounded status failure. No test calls the real
  release API; the exact-ID request is asserted against an in-memory stub.
- `npm test`: 38 database checks passed, plus DOM/actual Edge-handler/local PostgreSQL
  integration and four API boundary checks. Existing pgcrypto/canvas stand-ins remain.
- `actionlint` v1.7.7, verified against the official release SHA-256 checksum:
  both changed workflows passed syntax/expression validation; optional shellcheck
  and pyflakes integrations were disabled because they were not installed.
- `git diff --check`: passed. Browser tests are not run on this main-based branch:
  their existing reliability/isolation fixes remain in PR #3. No browser pass or
  live end-to-end validation is claimed by this assignment.

Final test counts and commit/review links are recorded in the draft PR. No production
security certification follows from passing synthetic CI.

## Residual risks and release blockers

The observed live self-review/review/check/workflow-inventory gaps are explicit
release blockers, not bypassed or fixed settings. The proposed preparation gate
rejects those conditions even before a deployment job could request approval.
The old automatic workflow remains on main until a separately authorized merge;
opening this draft does not remediate the running configuration.

GitHub administrators/owners can alter settings, identities or trusted workflow
code; code in this repository cannot supersede their authority. Reads are snapshots,
not an atomic lock against subsequent administrative changes. A move after the last
read never changes the pinned artifact/revision, but may require human cancellation.
Actions/token endpoint availability, OIDC/backend Pages compatibility and real
approval separation remain untested operational prerequisites. Pinned actions and
locked dependencies reduce drift but do not remove supply-chain/platform risk.

The frontend still contains URL PIN handling (`index.html` copies query `pin` into
sessionStorage), weak/shared pilot PINs, and legacy backend trust-boundary risks.
Flag these for Assignment 005B: URLs can expose PINs through history, copied links,
logs and analytics; migrate away from URL/shared weak credentials with a separately
reviewed authentication/session plan. No authentication or production data migration
is part of 005A. A gated release does not make the current application production-safe.

If a create request has been sent and status polling errors/times out, outcome is
unknown: inspect the authorized run/deployment manually. Do not retry creation or
claim failure means the site did not change. No automatic rollback/cancellation is
implemented because that is another operational change needing human judgment.

## Rollback — separate authorization required

1. Before any authorized release, record the known-good frontend commit, manifest,
   artifact ID/digest, workflow revision, Pages deployment/run IDs and settings.
   The one-day Actions artifact retention is not a long-term backup strategy.
2. To restore a known-good frontend, use the same gate with its full main-ancestor
   SHA, after confirming compatibility and obtaining a fresh human approval. If a
   historical commit cannot satisfy current checks/policy, prepare a reviewed new
   main commit restoring only frontend blobs while retaining the release controls.
3. Never revert the old automatic Pages workflow, restore whole-checkout publishing,
   loosen approval rules, use a floating branch/tag, or remove the guard to unblock
   a rollback. If the gate is broken, stop; review and authorize a control-only fix
   and validate it synthetically before any new release.
4. Only separately authorized human/staging checks should verify the restored site.
   Pages rollback changes frontend assets only, not Supabase schema/functions/data.
5. This draft alone needs no operational rollback: closing the PR leaves main and
   the live site/settings unchanged. No deployment occurred during this task.
