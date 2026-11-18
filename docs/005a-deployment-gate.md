# BOS 005A — Manual deployment gate

Status: implementation candidate. This branch does not authorize merge or deployment.

## What changes

- Removes automatic Pages deployment on pushes to `main`.
- Requires a manual dispatch from the workflow on `main`.
- Requires the exact full commit SHA intended for release.
- Rejects malformed SHAs, unknown commits, and commits not reachable from `main`.
- Checks out exactly the validated SHA with persisted Git credentials disabled.
- Gives Pages and OIDC write permissions only to the deployment job.
- Builds and uploads the static artifact in an unprivileged job from the exact
  validated SHA; the privileged deployment job does not check out or build code.
- Embeds `release-provenance.json` with the exact SHA and workflow run ID.
- Pins all third-party actions to the reviewed commits behind their current major
  version tags.
- Preserves one deployment at a time and does not cancel an in-progress release.

The `github-pages` environment must still require Daniel's approval. Repository and
environment settings are outside this branch and must be verified in GitHub before
the gate is treated as effective. A manual trigger is not, by itself, independent
approval.

## Required checks before merge approval

1. PR CI passes using synthetic data only.
2. A feature-branch push creates no Pages deployment.
3. Review confirms `push` is absent from the Pages workflow trigger.
4. Manual dispatch from a non-`main` ref is skipped.
5. Empty, short, uppercase, unknown, and non-`main` SHAs fail closed.
6. A valid commit reachable from `main` reaches the protected environment and waits
   for its required reviewer.
7. The resulting artifact is built from the requested SHA, not the workflow tip.
8. No alternative legacy Pages or deployment path bypasses this workflow.

Tests 4–8 require a separately authorized nonproduction GitHub dry run. They are not
proven merely because the YAML is present or PR CI passes.

## Rollback

Rollback is a separate, owner-approved dispatch using the full SHA of the last
known-good commit that remains reachable from `main`. Record the production SHA,
workflow run, Pages URL, and smoke-test result before and after release. Frontend
rollback does not roll back Supabase schemas, functions, or data.

## Remaining hardening

- Reconfirm pinned action SHAs during dependency updates; never return to mutable
  tags in the privileged release workflow.
- Verify branch protection, required checks, environment reviewers, self-review,
  administrator bypass, and all alternate publishing paths in GitHub settings.
- Keep the coding agent unable to approve or execute production deployments.
