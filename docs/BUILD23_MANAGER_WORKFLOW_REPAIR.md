# Build 23 manager workflow repair — engineering candidate

Status: draft, synthetic validation only. No merge, deployment, production request,
production-data mutation or paid API call was performed. This change prepares a new
working application/API/database path; it does not claim the hosted pilot is repaired.

## Baseline and existing work

All remote heads were fetched explicitly with `refs/heads/*:refs/remotes/origin/*`:
the checkout's default fetch configuration otherwise fetched only its current branch.
Existing local branches and remote PR branches were preserved.

The application baseline is `origin/main` at
`45a61c83aac0ad521046bcad9a04ed8e8cc35193`. It is the latest shared application
revision and still labels itself UI Build 22. No inspected remote has a complete
Build 23 manager implementation. Build 23 here means this explicit repair candidate,
not the release-authorization ADR branch previously checked out.

Reviewed and reconciled:

- `dev/bos-008-manager-routing` at `2f08dbc2c14c723930295dbd04288ecec3ec8cab`
  is a plan only, based on an older application. It records an open moderate finding
  omitted from the manager-specific work queue, with no corrective action or deadline.
- Draft PR #12, `fix/build-23-vehicle-manager-actions` at
  `3b426257b0b2e930a56a86f511361751f04f467c`, adds a partial vehicle-only RPC.
  Its Plant-Manager-only mutation guard excludes Rotation Managers; it has no
  dashboard/evidence integration and uses legacy RPC stand-ins in tests. It is not
  the baseline or a complete backend to silently depend upon. It remains unchanged.
- Older all-inspection and manager-comment feature branches remain read-only or
  intentionally gated. Their client-side editing switches do not provide authorization.
- PR #3 at `3349387074b7ca38e870769d54bf2a34f87ff607` supplies the reviewed browser
  isolation/locator correction and PR CI. Those test/CI files were integrated here
  without merging, rewriting or changing PR #3. CI action refs are immutable pins.
- Release/security Draft PRs #6–#9/#11 and the scheduled-runner draft are unrelated
  to this repair and were not imported or modified. The Pages workflow is unchanged.

## Root causes and corrections

| Defect | Source evidence / correction |
| --- | --- |
| Management editing unavailable | `manager.html` and `app-v11.js` explicitly presented inspection history as read-only; edit controls applied only to the acknowledged RED owner. New workspace uses server-calculated capabilities and authenticated mutations, including moderate intake |
| Plant Manager cannot manage submissions | Legacy `manager_queue(manager_id)` is an assigned-work queue; unassigned findings never enter it. Scoped intake imports only reviewed/mapped open legacy findings without an existing active action, and new employee submissions enter the same queue immediately |
| Rotation Manager cannot manage submissions | Partial PR #12 gates mutations to Plant Manager. New server policy explicitly supports Plant Manager, Rotation Manager and On-Rotation Manager with the same facility/tenant checks and independent verification requirement |
| Action Required is zero | `app-v12.js` counted only legacy `home.tasks`. New corrective/verification items derive from the authenticated workflow's authoritative scoped queue; linked legacy items are removed to avoid duplication/cross-facility leakage. Failures, incomplete mappings and unreconciled legacy work show an unavailable count, not a false zero |
| Inspection/photos/persistence gaps | Prior all-pass vehicle flow sent no submission, multi-deficiency saves were separate calls, and initial photos were filenames only. New submission persists the entire checklist transactionally, stores actual photo bytes and preserves a request ID for idempotent retries |

## Implemented transaction and authorization model

`b23_manager_workflow` is service-role-only, SECURITY INVOKER, with empty search_path.
The Edge function derives identity from the existing hash-backed, expiring B23
session. Caller-supplied manager/employee/organization/facility/status fields cannot
supply authority. Active employee, organization, role and current explicit facility
membership are checked again on requests. Revocation and expiry do not wait for a UI
refresh. All seven new tables have RLS enabled and no anonymous/authenticated grants.

- Employee: submit only enrolled facility assets; retrieve/acknowledge own new
  findings. No management mutation, independent verification or other employee's
  imported record access.
- Plant/Rotation Manager: intake and review in explicit enrolled facilities only;
  acknowledge, comment, assign/route to an eligible active manager in that same site,
  and set deadlines. No organization-wide permission is inferred from a job title.
- Assigned manager: save plan/controls/deadlines, upload corrective evidence and submit
  repair. The other manager can independently approve/close or reject for rework.
  Self-verification is denied at the server even if a browser exposes a button.
- Repair evidence is bounded PNG/JPEG content, stored privately with actor,
  photographer, note and work revision. Completion requires current-assignment
  After Repair evidence. Reassignment/rejection invalidates prior evidence for a new
  completion. Historic pictures remain in the audit trail.
- New deficiencies are conservatively RED/out of service without calling a paid
  classifier; acknowledgment/completion never clears that restriction. Only authorized
  independent closure changes the case to verified closed. This conservative pilot
  classification requires owner review; hosted classification behavior is not certified.
- Row locks and expected revisions reject stale updates. A transaction-level request
  lock plus unique reporter/request ID prevent duplicate inspection submission. A
  failed photo/deficiency rolls back the entire inspection, not a partial batch.
- Plans, comments, assignments, deadlines, photos, rejection and closure are durable
  records with authenticated audit events. No email/SMS or paid-model call is made.

Historical import is scoped and fail-closed. Asset IDs must be explicitly mapped to
an active mine in the actor's organization and membership. Conflicting/ambiguous
asset or facility data is rejected, never assigned to the first mine. Existing
in-progress legacy corrective actions are not automatically taken over. Their
presence produces a reconciliation warning and unknown action count. Imported open
records keep their source ID; status changes mirror transactionally to that source
only if its organization, asset and open state still match. No legacy write RPC is
invoked or stubbed as proof of the repair.

New inspection/corrective records are in `b23_workflow`; they are not automatically
backfilled into legacy inspection analytics. The new manager history shows these
submitted inspections, including all-pass results. Reconciliation/cutover of old
reports and in-progress actions is a deployment prerequisite, not silently claimed.

## Browser integration

- `manager.html` uses `manager-v23.js` and `b23-workflow-client.js`. Both supported
  managers can reach authorized findings, with actor-derived capabilities, history,
  photographer provenance, actual photos and independent verification/rework.
- `inspection.html` uses `inspection-v23.js`: explicit full submission, required
  photo content and explicit employee acknowledgment. All-pass inspections persist.
- Home retains unrelated legacy read-only modules but gets corrective task identity
  and counts from the new scoped API. It refuses a mismatch between session identities.
- Management/inspection navigation no longer places a PIN in new links. The new
  session client stores only the bearer token; existing unrelated legacy PIN/session
  code remains outside this bounded repair and still needs the Issue #5 auth review.
- Old corrective/verification entry pages redirect to the authenticated manager
  workspace. They no longer issue browser-supplied-identity writes. This is not a
  security fix for someone directly calling the old hosted API.
- User strings are escaped/text-rendered. No client capability flag replaces server
  checks. Failed queue refresh is distinguished from a failed save; failed counts
  are unavailable rather than zero.

## Validation evidence and limits

Current local results: 82 new database/Edge/security checks passed; 23 new real-browser
checks passed; all 38 existing onboarding database checks, the existing DOM/Edge
integration and its four API boundary checks passed. The existing isolated onboarding
browser suite also passed, including its four boundary checks and HTTP/WebSocket
isolation probes. No tests are described as live validation. The exact commit and
remote CI evidence are in the draft PR.
Reproduce from this branch with Node 24 and Python-independent npm fixtures:

```sh
npm ci --ignore-scripts
npm test
npx --no-install playwright install chromium
npm run test:browser
```

This cloud instance used system Chromium via
`BOS_BROWSER_EXECUTABLE=/usr/bin/chromium npm run test:browser`.

- Existing onboarding PostgreSQL and actual Edge/DOM regression suites are retained.
- New database/Edge tests execute the actual migration and handler against PGlite.
  The legacy `findings`/`mines` catalog fixture models the explicit minimum interface;
  there are **no legacy corrective RPC stand-ins**. Existing pgcrypto stand-ins test
  flow/authorization only, not production cryptographic strength or real token entropy.
- Tests cover both directions of Plant/Rotation assignment, both managers completing
  and independently verifying, comments/deadline retention, real photo bytes, rejected
  rework requiring fresh evidence, closed-record immutability, stale versions,
  duplicate submissions, all-pass persistence and atomic failure of a multi-deficiency
  submission. Snapshot/reopen restores state/comments/photos/audit in a fresh engine.
- Unauthorized tests cover employee edits, spoofed IDs/extra fields, unassigned
  edits, cross-facility/tenant read and assignment, self-verification, disabled or
  expired actors, missing role, membership revocation, inactive facilities, direct
  anon/authenticated table/RPC access and wrong-origin requests.
- Browser tests use actual forms, actual Edge handler and the same SQL. Only unrelated
  legacy **read** login/home/onboarding-status responses are mocked; their home task
  list intentionally returns zero to reproduce the counter bug. Any legacy write or
  unknown route fails the mock. Actual backend requests never leave the test machine.
- Context-wide exact asset/API allowlists, blocked service workers and denied HTTP/
  WebSocket probes prevent browser fallthrough. Nothing calls live Supabase or a
  paid API. Synthetic mobile/desktop screenshots are ignored generated test outputs.
- These are synthetic candidate results, not deployed permission, hosted-schema,
  real credential, storage durability under power loss, or production end-to-end claims.

## Genuine remaining deployment blockers — do not bypass

1. **Hosted legacy schema/API source is missing from this checkout.** Obtain a reviewed,
   redacted schema-only contract/export and legacy function source through an approved
   process. Validate JSON status mirroring, enums, required organization/role columns,
   existing constraints/triggers, grants and compatibility before applying anything.
   Local catalog fixtures cannot certify that contract.
2. **Reviewed enrollment is required.** Populate assets and employee/mine memberships
   from authorized organization/facility records. No real users, asset mappings, roles
   or facilities are invented or seeded by this migration. Missing/contradictory
   historical organization/site data remains blocked. No live records were inspected.
3. **Legacy authorization cutover.** Retire/deny the old anonymous employee-ID manager
   write paths, reconcile active legacy actions/history/evidence and migrate reporting
   consumers before enabling the new client. This source repair does not secure an
   unversioned hosted RPC or prevent a direct caller using its old bypass. Do not run
   mixed writers and claim complete workflow integrity.
4. **Separate deployment approval.** The new Edge function needs the existing platform
   Supabase service bindings, custom bearer verification (platform verify_jwt false),
   exact allowed browser origin and separately approved migration/function/frontend
   deployment. No key is added to frontend/config, no deployment is made here. Reviewed backend migration, enrollment and function installation must precede any frontend activation; do not publish the frontend against an absent service. Apply
   the migration once through an approved transactional tool, not blindly on retries.
5. **Release security is still on HOLD.** Main's automatic Pages workflow remains
   unchanged. CI/browser protections from PR #3 are integrated here to produce the
   existing required synthetic check; that is not merge/release authorization.
   Owner review, independent identity, permission and release-gate issues from #5/
   #8/#9 remain. No merge, workflow dispatch or settings change is implied.
6. **Pilot authentication/policy.** Existing short-PIN authentication remains a test
   boundary; strong independent identity/session and broader role policies require
   the separately reviewed auth remediation. Other management roles and mechanic/
   employee repair assignment are not silently granted access by this change.

## Rollback and preservation

This unmerged candidate changes no live system; close its draft to abandon it. All
existing remote branches/PRs are preserved. Before a future authorized rollout,
record schema version, known-good frontend/function revisions, case/evidence backups
and the legacy reconciliation plan. On failure, stop writes and preserve audit and
photos; do not drop the new schema or re-enable the old anonymous write API as a
shortcut. Restore only an explicitly authorized compatible application/backend
version after reconciliation. Frontend rollback alone cannot undo a database change.
