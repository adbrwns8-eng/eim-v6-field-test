# Assignment 003: owner configuration checklist

Proposed settings only. No settings are changed by this branch.

## Before any merge into main

- [ ] Owner verifies the current Pages configuration. The reviewed configuration
  has both legacy main-branch publishing and an Actions deployment workflow.
  Move to one Actions-only publishing path, eliminating automatic legacy publishing.
- [ ] Protect the `github-pages` environment: Daniel is a required reviewer,
  administrator bypass is disabled, and only protected `main` can deploy.
  Confirm reviewer/self-review settings using separate human and agent identities.
- [ ] Confirm every production publishing path is gated; a manual workflow trigger
  or an environment name alone is not an approval control.
- [ ] Protect `main` with an active ruleset or branch protection requiring PRs,
  Daniel's approval of agent-authored PRs, dismissal of stale approvals, review
  of the latest push, resolved conversations, and passing required checks.
- [ ] After the first successful PR run, require the exact check shown by GitHub:
  `Synthetic npm and browser tests` from workflow `PR CI`. Verify its source is
  GitHub Actions and require the branch to be up to date before merging.
- [ ] Block force pushes and branch deletion. Apply protections to administrators;
  grant no agent bypass. Keep development in isolated `bos/<task>-<description>`
  branches and separate task worktrees.
- [ ] Require owner review for workflow/protection-related changes (for example,
  a CODEOWNERS rule plus enforced code-owner review). The owner cannot approve
  their own PR: agents need a separate development identity.

## Least privilege and deployment separation

- [ ] Replace inherited owner/admin credentials with a repository-scoped agent
  identity: only feature-branch development and PR permissions, no administration,
  environment approval, production secrets or production database access.
- [ ] Restrict agent access to deployment dispatch and production workflows.
  Verify effective permissions: GitHub permissions can couple workflow operations;
  if deployment initiation cannot be separated, remove agent Actions write access
  and use an owner-controlled release mechanism. Never claim a prompt is a gate.
- [ ] Keep production credentials unavailable to PR jobs; use read-only token defaults
  and disable approval of PRs by Actions. Never use pull_request_target to execute
  untrusted PR code with elevated access.
- [ ] In a separately approved change, scope Pages/OIDC write permissions to the
  gated deployment job, pin actions to reviewed immutable SHAs, and publish an
  explicit frontend artifact rather than the whole repository.
- [ ] Require deployment approval for the exact tested commit/artifact; new changes
  invalidate approval. No deployment or backend migration is authorized here.

## Verification after separately authorized settings changes

- [ ] Verify an agent cannot push to main, bypass review, change protections,
  approve a production deployment, or deploy from a feature branch.
- [ ] Verify failing CI blocks merge and passing CI still requires Daniel's review.
- [ ] Only with explicit deployment-test authorization, verify publishing waits
  for Daniel and cannot proceed through legacy Pages or administrator bypass.
- [ ] Verify inaccessible branch-protection, Actions-permission, and secret-scanning
  settings in the owner UI or with appropriately scoped read access.

## Cloud persistence and scheduled/delegated work (future authorization)

Create a reusable cloud configuration in Codex settings with Node 24, locked npm
setup, Chromium, scoped GitHub access and no production credentials. Start a fresh
session from it to verify provisioning, checkout/revision and tests. Current runtime
availability does not establish persistence. Keep durable memory, task dependencies,
approvals and audit records in private Project 000, not this public repository.
Pilot one read-only scheduled report in America/Chicago, then one scoped delegated
local task; record actual environment, commit, results and delivery. Require task
leases, concurrency/cost limits, dependency and approval checks before unattended work.
