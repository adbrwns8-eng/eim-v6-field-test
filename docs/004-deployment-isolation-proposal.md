# BOS Assignment 004 — Deployment isolation proposal (NOT IMPLEMENTED)

Status: proposal only. This document makes **no changes** to production deployment configuration. Do not merge or deploy this PR as an authorization to publish. PR #3 remains Draft.

## Verified current state (2026-11-16)
- `.github/workflows/pages.yml` on `main` runs on pushes to `main` **and** `workflow_dispatch`; it requests `contents: read`, `pages: write`, and `id-token: write`; its deploy job targets `github-pages`.
- Active ruleset `BOS — Main Branch Protection` targets `main`, requires one approving PR review and strict `Synthetic npm and browser tests` status check, and has no bypass actors. Its required CI workflow currently exists only in Draft PR #3, **not** on `main`. Verify whether GitHub can produce the required check on each future PR before relying on this gate.
- The environment's screenshot showed one required reviewer (`adbrwns8-eng`), self-review not prevented, and deployment branches restricted to `main`. The screenshot does **not** prove a separate reviewer is required.
- GitHub Pages settings showed GitHub Actions as publishing source. No other production publishing path has been independently ruled out.
- Existing workflow actions use version tags, not immutable full commit SHA pins.

## Target security invariants
1. Agent branches and PR events must never publish the live site or receive Pages write / OIDC deploy credentials.
2. No push to `main` automatically publishes; publishing is an explicit owner-controlled release action.
3. Only the intended reviewed commit on `main` can be published; avoid releasing a newer, unreviewed commit through a race.
4. Deployment must require an effective human approval gate. If a separate reviewer cannot be configured, document that this is owner approval, **not independent approval**.
5. A successful CI run is not equivalent to production security certification.
6. No secrets, production employee data, or live Supabase mutations are used in PR tests.

## Proposed code change for a separate implementation PR (NOT APPLIED)
In `.github/workflows/pages.yml`:
- Remove `push: branches: [main]`; retain **only** `workflow_dispatch` for explicit releases.
- Give the dispatch an input for a full 40-character reviewed commit SHA; validate that the SHA is reachable from `main` and equals the explicitly approved release target. Fail closed on mismatch.
- Keep the deploy job's `environment: github-pages` and minimum necessary Pages/OIDC permissions. Ensure the workflow runs from `main` and checkout uses the verified approved SHA, not an arbitrary branch.
- Set `persist-credentials: false` for checkout. Pin action versions to reviewed full commit SHAs after inventory and compatibility checks.
- Preserve serialization of production deployments and document how an authorized maintainer approves a run.
- For stronger isolation, prefer a separate release workflow/repository and an approval actor not usable by the coding agent. Do not give Codex release permissions, deployment environment secrets, or access to the human approval identity.

**Important limitation:** GitHub's `workflow_dispatch` can be triggered by users with sufficient repository access. Environment approvals alone are not an independent release boundary if the triggering actor can approve their own run. Protect the GitHub identity and release permissions separately.

## Proposed repository/environment settings (owner-operated, not changed)
- Confirm `github-pages` requires approval and restricts deployment to `main`. Decide whether `Prevent self-review` can be enabled with an independent trusted reviewer; if not, explicitly accept the weaker owner-only control rather than claiming independence.
- Verify all Pages publishing paths, reusable workflows, deployment tokens, GitHub Apps, and administrators. Check that no alternative path can deploy without the gate.
- Resolve the **one-reviewer deadlock**: a sole PR author cannot ordinarily approve their own PR. Add a trusted reviewer or use a deliberately documented governance alternative; never disable the gate merely to get an AI change merged.
- Verify the required CI check actually runs for PRs from the proposed development branch, especially before PR #3 is merged. Avoid a ruleset that requires a check that no workflow can emit.
- Restrict agent installation permissions to minimum repo scope. No agent authorization to change rulesets, workflow permissions, environment settings, or publish production.

## Acceptance tests — must pass BEFORE deployment authorization
1. Agent opens draft PR with synthetic changes: CI runs, no deployment run, no Pages credentials.
2. A push to an unprotected feature branch cannot deploy.
3. A push to `main` after approved merge does **not** deploy automatically.
4. A manual release attempt without human approval remains blocked.
5. A manual release with wrong SHA, wrong branch, or an unreviewed SHA fails closed.
6. Authorized manual release of the approved `main` SHA passes approval and deploys only that SHA.
7. Verify no bypass via legacy Pages publishing, alternate workflows, administrators, or compromised agent credentials.
8. Test the actual PR review and required status check end-to-end with a nonproduction sample PR.
9. Verify the app's existing critical flows against a staging target before release, including employee login, inspections, management, and tenant isolation.

## Rollback and recovery
- Before any implementation, record the exact production commit SHA, Pages deployment URL and run ID, current environment/ruleset settings, and a known-good site artifact.
- Rollback must be a separately authorized release of the last known-good commit/artifact through the same controlled deployment gate; never silently re-enable push-to-main deployments.
- If the new release workflow blocks all releases, stop and diagnose with owner approval; do not remove branch protection as a quick fix.
- GitHub Pages rollback only reverts frontend assets. Supabase schema, functions, and data need independent backups, backward-compatible migrations, and their own rollback plan.
- After rollback, run smoke tests and record incident and remediation.

## Sequence and approval boundaries
A. Review this proposal-only PR. No operational change.
B. Independently resolve CI required-check availability and reviewer governance.
C. Open a **separate draft implementation PR** with the actual workflow change and automated verification.
D. Approve implementation merge separately; recognize merging changes the workflow on `main` but must not publish without explicit dispatch.
E. Execute a controlled staging dry run and then separately authorize first production release.

Owner approval to write this proposal is **not** authorization to merge, alter settings, enable Codex deployment rights, or deploy.
