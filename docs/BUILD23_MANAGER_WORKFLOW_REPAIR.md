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

---

# Read-only hosted compatibility and deployment-readiness assessment

Assessment date: 2026-11-24. Reviewed implementation:
`5f00361ce60451e99c1c85648d5d0389eb2b9ea4` / Draft PR #13.
**Decision: NO-GO. Hosted compatibility is not established.** This follow-up changes
only this report. No hosted schema/data, runtime code, mappings, credentials,
permissions, migrations, frontend or deployment configuration were changed.

## A. What was actually accessible

| Check | Actual evidence | Conclusion |
| --- | --- | --- |
| Repository / PR | Clean checkout and PR #13 remote head both resolved to `5f00361ce60451e99c1c85648d5d0389eb2b9ea4` | Implementation available for static comparison; not hosted-version evidence |
| Target in committed frontend | `abnydnnafyosrakkgajy.supabase.co`, legacy function `v6-test1-api` | Configured target only; project ownership, current release and deployed handler not independently verified |
| Metadata-only request | GET `https://abnydnnafyosrakkgajy.supabase.co/rest/v1/`, Accept `application/openapi+json`, no credential or application-row query | HTTPS proxy CONNECT rejected with **HTTP 403 Forbidden**; no hosted HTTP status or schema response received |
| Environment configuration metadata | Restricted/enforced networking; custom host `api.github.com` plus package presets; target Supabase host absent; no configured secrets, runtime-variable bindings or outbound identities | No approved hosted database route/identity supplied by environment configuration; no changes requested/applied |
| Process variable discovery | Names/presence only: no matching exported Supabase/database/PG connection variables found | No credential values read or printed; absence here does not mean the owner lacks access elsewhere |
| Local access/config presence | psql/Supabase CLIs not installed; repository .env/.env.local and linked project-ref absent; usual .pgpass/.pg_service.conf/Supabase-token candidates absent (presence only checked) | No existing local catalog connection discovered; installing a CLI alone would not grant access |
| Connected capabilities | No callable Supabase/PostgreSQL/catalog-query connector discovered | No alternate authenticated read-only route available to this task |
| Repository backend content | Onboarding SQL/Edge source and candidate workflow SQL/Edge source; no versioned legacy `v6-test1-api` source or authoritative hosted DDL/config export | Cannot derive actual legacy constraints, enums, procedures or grants from synthetic fixtures |

No legacy business endpoint, login, queue/home RPC, employee/asset listing or
corrective-action record was requested. A read-sounding action can have side effects;
without its audited contract it is not used for this read-only assessment. No PIN,
API key or signed URL was extracted from files, artifacts, logs or browser storage.
No direct-network/proxy bypass, credential rotation or allowlist edit was attempted.
Historical deployment claims in earlier PR descriptions are not current hosted proof.

The candidate's own `home` action calls `import_open` and can insert intake/audit
rows. It is **not a read-only hosted probe** either. No business action, including
new/legacy home or login, was executed for this assessment; only the metadata root
GET was attempted. Test fixtures/official GitHub API schema files found locally are
not an authoritative export of the hosted Supabase schema.

## B. Exact read-only evidence needed to finish the comparison

Provide these through an approved **private** evidence channel or a verified
catalog-only connection. Do not paste secrets in chat or commit raw exports,
employee rosters, open-case data, photographs, PINs, hashes or tokens to this public
repository. Record project identity, capture time, scope, collector authority,
visibility limitations and artifact hashes. Missing visibility is not an empty table.

1. **Target/access confirmation:** owner-confirmed project/ref and environment;
   approved TLS/egress route; actual authorized database/pooler hostname if a catalog
   connection is chosen; evidence that its role is read-only. Do not infer a database
   hostname/region or use a broad service key/employee login as a substitute.
   Alternatively supply reviewed schema-only/API exports without a live connection.
2. **Catalog/DDL:** PostgreSQL/version/extensions; column types, domains, defaults,
   nullability, generated/identity columns, keys, FK actions, checks, enum labels,
   indexes, triggers and migration ledger for `employees`, `mines`, `findings`,
   `corrective_actions`, actual plant/vehicle asset tables, actual inspection/header/
   answer tables, evidence/revision/alert/escalation tables, and `b23_private` objects.
   Names of unknown underlying tables must come from the real API/source, not guesses.
3. **Authorization metadata:** schema/table/column/sequence grants, role membership,
   RLS enabled/forced flags and policies, function execute grants/default privileges,
   SECURITY INVOKER/DEFINER, owner, search_path and function dependencies. Verify actual
   `anon`, `authenticated`, `service_role` identities and effective RLS behavior.
   Do not export passwords, live sessions or authentication table data.
4. **Procedure and API source:** exact deployed legacy Edge version/source hash,
   route-to-RPC map, function signatures/definitions/overloads and referenced helpers;
   original and candidate B23 login/logout contract; deployed JWT-verification/CORS/
   request-size/runtime configuration and binding **names/status only**. Function
   bodies/config may contain embedded secrets: review/redact privately, never dump
   them into PR logs. A PostgREST OpenAPI file alone cannot prove triggers, RLS or all
   procedure behavior.
5. **Approved minimal mapping projections:** facility UUID/organization/active flag;
   asset UUID/type/code and approved facility/effective-date history; employee UUID,
   organization, active/role/access/is_manager flags and approved facility membership/
   rotation intervals. Obtain explicit scope approval for JK Farms and Borland. No
   PIN, pay, HR, contact, location-tracking or unrelated personnel data is needed.
6. **Approved reconciliation projection:** pseudonymous case/source/action IDs,
   organization, reporting-time asset/facility, lifecycle state, assignment/deadline,
   acknowledgment/completion/verifier references, revision/timestamps and media
   object/hash/provenance metadata. Start with scoped counts and discrepancy buckets;
   inspect descriptions/person identities/media only when specifically authorized.
   No actual case inventory or count was obtained in this assessment.
7. **Recovery/deployment inventory:** installed versions/checksums, migration tool's
   transaction behavior, every writer/consumer/job, evidence storage/bucket policy,
   backup/PITR availability, retention/encryption and a demonstrated restore result.
   Availability is evidence to collect, not an assumed Supabase plan entitlement.

For a catalog connection, the owner/operator should use a read-only role and a
bounded READ ONLY transaction and inspect catalogs/information_schema only; do not
execute custom business RPCs to discover their behavior. Even catalog visibility
can be permission-filtered, so include the role/scope and identify redacted objects.
Any account provisioning, new access/egress or private-data projection needs explicit
owner/data-custodian approval outside this documentation update. Secret values must
use the secure environment mechanism if access is later authorized, never this report.

## C. Candidate contract versus unknown hosted contract

All hosted-result cells are **UNVERIFIED**. The middle column is what committed
candidate code requires, not a description of production. Source links below pin the
reviewed implementation. Local catalog fixtures prove only their synthetic interface.

| Surface | Candidate requirement / behavior | Hosted verification needed / precise remediation |
| --- | --- | --- |
| Identity FK | UUID `public.employees.id`, active boolean; name fields used by home/assignee query | Verify PK/type/constraints and name layout; adapt against real DDL, not a guessed fixture |
| Organization / role | Employee `organization_id`, `is_manager=true`, `access_level='manager'`, exact Plant/Rotation/On-Rotation role labels | Obtain actual columns/types/values and approved role matrix; missing labels deny, never infer administrator or organization-wide scope |
| Facility FK | UUID `public.mines.id`; organization/active fields; optional name display | Verify real facility table and canonical JK Farms/Borland identities; name mismatch is not authority |
| Existing source findings | JSON keys id/organization/status/description plus vehicle_asset_id or equipment_id and optional mine_id | Verify actual relationship, nullability and historical reporting site; ambiguous IDs/missing org/site must remain quarantined |
| Existing corrective actions | Source table finding_id/status; terminal names verified/closed/cancelled | Catalog enum/domain and real lifecycle semantics required; unrecognized/active work cannot be treated as unassigned |
| Status write | Source status populated through `jsonb_populate_record`, mapped to open/assigned/pending_verification/closed | Check enum/check acceptance, triggers, policies and operational/equipment/alert side effects before any write; no actual status update was made |
| Severity | Imported high/critical or RED -> high; otherwise moderate. New deficiencies conservatively high | Owner approves complete mapping; unknown hosted categories must not silently fall through to moderate. Validate operational restriction and multiple-finding asset behavior |
| New namespace | Creates b23_workflow schema, seven tables, indexes, identity sequences and functions once | Inspect existing namespace/migration ledger/object hashes; migration is not blindly repeatable; do not drop an existing schema on error |
| Auth dependency | b23_private.sessions token_hash/employee_id/expires_at and public.b23_onboarding login/logout | Verify installed signatures, actual pgcrypto hashing/randomness, expiry/revocation/throttling and grant behavior; do not log in to production to test |
| Crypto/runtime | extensions.digest, gen_random_bytes and gen_random_uuid; PostgreSQL JSON/locking; Deno Edge runtime | Verify version/extensions/search paths and real runtime/type/bundle behavior; PGlite crypto stand-ins are not this proof |
| RLS/privileges | New tables RLS-on, no anon/authenticated grants; service-only invoker RPC and helper grants | Inspect actual effective role memberships, bypass/owner behavior and inherited/public privileges; no blanket RLS/grant changes without a consumer audit |
| Evidence | PNG/JPEG bytea, 2 MiB/file, 8 MB HTTP request, work-revision/provenance checks | Compare deployed ingress/body/storage limits, format validation, media ownership/retention and restoration; filenames or legacy URLs alone do not prove evidence |
| Inspection persistence | New private headers/answers/cases; all-pass submission and idempotency | Map actual legacy inspection/report dependencies and required aggregates; new private records do not automatically appear in old reports |
| Edge contract | POST JSON action/data, bearer session; service-only SQL transport; strict origin; custom bearer check | Verify installation/version and platform verify_jwt setting, allowed origin and secure binding names; no credentials in the client |
| Existing frontend dependencies | Home retains legacy login/home/onboarding-status and unrelated modules | Audit real read/write/auth side effects and identity equivalence; replacing the management page does not authorize or secure all remaining legacy routes |

## D. Additional source-level readiness blockers discovered

These are static design observations at the reviewed SHA, **not hosted exploit
results**. This read-only follow-up does not change implementation or claim fixes.

| ID / priority | Evidence and blocker | Precise remediation / required approval |
| --- | --- | --- |
| HC-01 / P0 | Proxy rejection, no authorized catalog binding/connector; deployed source absent | Owner authorizes a bounded private export or catalog route; verify project and visibility before marking any hosted comparison passed |
| HC-02 / P0 | Findings/inspections store asset_id, but not immutable organization/reporting-mine snapshots. `scope()` and detail/home access follow the asset's **current** mine binding | Design an immutable reporting-site/tenant snapshot or versioned asset assignment and reject unauthorized in-place reparenting. Add same-site/cross-tenant asset-move history tests before activation. Owner approves schema/data migration and facility policy. Existing fixed-membership tests do not prove remap safety |
| HC-03 / P0 | import_open skips already imported source IDs; later mutations check source org/asset/not-closed, not full source revision or absence of a newly created legacy action | Fence all legacy writers before import; define a source fingerprint/version and concurrency/state ownership rule; test insertion of a legacy action or changed description/state after intake. Do not run both engines as competing writers. Owner approves cutover and reconciliation |
| HC-04 / P1 | Source status mirroring does not update legacy corrective-action/report tables, original comments/photos/verifier history or all inspection aggregates | Maintain a reviewed crosswalk and private archive; implement approved reporting adapters/backfill and verify joins/uniqueness before claiming report parity. No source action may be fabricated to satisfy old reports |
| HC-05 / P1 | Lifecycle/severity vocabulary and equipment/RED-alert side effects are unverified; source severity has a default moderate branch | Validate every category and unknown-value denial; define closure versus return-to-service, including another open RED finding on the same asset. Safety/process owner approves mappings and restrictions |
| HC-06 / P0 | Required JK Farms/Borland identity, asset and employee memberships are not supplied | Facility/data custodians approve actual IDs and historical assignments; no first-mine, name-match, check-in or organization-wide shortcut. Keep incomplete counts unavailable |
| HC-07 / P0 | Source clients send manager/employee IDs without a bearer on legacy mutation routes; hosted enforcement and direct SQL execute grants are unknown | Audit deployed handler/RPC grants and every old client/job; deny retired routes and direct RPC alternatives in the authorized cutover, verified in nonproduction. No production denial probes that could accidentally write |
| HC-08 / P1 | Existing B23 short-PIN provider and broader onboarding API remain dependencies outside the new workflow scope | Review installed auth/session/tenant behavior and duplicate/retired identities, without exporting PINs or tokens. Owner approves pilot risk or separately reviewed stronger auth. New workflow checks do not certify every old module |
| HC-09 / P0 | Backup, restoration, reconciliation and capacity evidence unavailable | Owner authorizes protected backups and an isolated restore rehearsal; include all private media/ACLs/audit and test failure/forward recovery, not frontend-only rollback |
| HC-10 / P0 | Main still contains automatic Pages deployment; release governance holds from Issue #5 remain | No merge as a substitute for approval. Daniel gives separate migration/function/frontend/release decisions through the approved authorization design; do not alter settings in this task |

HC-02 is a concrete schema-policy dependency: moving an asset binding would change
which facility's managers pass scope for **historical** cases/photos unless an
immutable/versioned site boundary is added. Whether any hosted asset currently
moves is unknown. Do not label the risk resolved because static-fixture role tests
passed. HC-03 likewise requires a new nonproduction mixed-writer/race test, not an
assumption that the hosted legacy action engine is already retired.

## E. JK Farms / Borland mappings — specification, not fabricated enrollment

| Facility named in source | Canonical mine UUID / tenant / active status | Asset roster and historical reporting site | Approved staff/rotation membership |
| --- | --- | --- | --- |
| JK Farms | Not obtained | Not obtained | Not obtained |
| Borland | Not obtained | Not obtained | Not obtained |

Required private manifest rows:

- **Facility:** canonical UUID, organization UUID, canonical label/aliases, active
  state and owner approval. Display text in Morning Update is not a canonical ID.
- **Asset:** actual plant/vehicle source table, UUID (not display equipment code),
  kind/code, reporting-time mine/organization, current binding, effective dates,
  movement history, collision/duplicate resolution and approval evidence. Check
  both vehicle_asset_id/equipment_id, multi-ID conflicts and missing/deleted assets.
- **Employee:** actual UUID, organization, active flag and approved role/access
  capability; permitted mine IDs, rotation start/end and explicit authorization
  source. Roster/check-in/presence/location text does not grant access. Do not assume
  a Rotation Manager covers both sites, or an owner/admin/mechanic is implicitly
  eligible under the candidate's three exact manager role labels.
- **Verification eligibility:** active qualified independent verifier per facility,
  distinct from the repair completer, including absence/rotation transitions. Data
  ownership and release approval are separate from permission to close a repair.

Store approval timestamp and manifest checksum privately, preserve source IDs and
lineage, and obtain named custodians' sign-off for both facilities. No real people,
UUIDs, memberships or asset assignments were created by this assessment.

## F. Reconciliation and reporting plan

Use an owner-approved consistent read-only snapshot first, with private scoped
counts/discrepancy buckets. Freeze competing writes only in a **later authorized**
cutover. No rows or counts below are actual hosted findings.

| Inventory class | Required treatment |
| --- | --- |
| Open, unassigned, complete site/tenant identity | Candidate intake only after source/constraint proof; preserve original source/finding/inspection numbers, reporter, times and evidence references in a crosswalk; verify one case per source |
| Assigned / accepted / repair-in-progress | Do not auto-import as new or reset ownership. Reconcile actual action revisions, accountable actor, plan/deadline, controls, evidence and state; manager confirms handoff before any separately reviewed migration |
| Pending independent verification | Preserve actual completer and independently eligible verifier, after-photo content/provenance and restriction. Do not self-verify, fabricate evidence or silently close |
| Rejected / rework | Preserve rejection reason, revision and work identity; verify fresh-after-evidence semantics and routing with the real historical contract |
| Closed/cancelled history | Keep audit/media readable under immutable historical scope; no re-opening/reclassification merely to make an import succeed |
| Unknown state, duplicate active actions, missing/cross-tenant actor/asset/site | Quarantine for human adjudication; fail complete counters/activation as required, never delete, guess or assign to the first mine |

Reconcile counts by facility, tenant, lifecycle and source: legacy baseline,
converted/excluded/quarantined rows, expected new rows, duplicates and differences.
Reconcile bytes/hashes, photographer/uploader identity and timestamps for before/
after evidence; storage object metadata is not proof a filename has image content.
Preserve old media privately until retention and restoration are approved.

Define which datastore owns each state after cutover. New private inspections/cases
must feed manager/owner dashboards, all-inspections history, counters, morning
summaries, overdue/notification queues, verification, equipment availability and
exports. Establish stable crosswalks and adapters for every consumer; do not treat
`source.status` mirroring as synchronization of all related tables. No simultaneous
old/new writer authority is accepted. Close a case without authorizing operation of
an asset that has another unresolved restriction. Human/process owners approve the
Action Required definition and reporting parity; do not invent expected live totals.

## G. Legacy write-path retirement inventory

Static inventory at main `45a61c8`; names below are browser `?a=` actions, not a
verified deployed route/RPC map. Exact SQL functions, overloads, triggers and exposed
PostgREST alternatives still need evidence. No hosted route was called to test this.

| Action family to fence/replace before activation | Source evidence / required decision |
| --- | --- |
| `submit`, `submit_vehicle`, `ack` | Legacy inspection HTML and app-v10; replace/fence producer writes after new submission/ack/report compatibility is proved, preventing duplicate inspections and finding writers |
| `take_ownership`, `assign_transfer`, `edit_corrective` | app-v10; retire identifier-authorized ownership/assignment/edit alternatives and their callable SQL overloads |
| `manager_ack`, `red_acknowledge`, `escalate` | app-v10/v11/v12; audit alert/ack/escalation tables and automate transitions only under the approved scoped identity |
| `manager_open` | app-v10; side effects **unknown**. Fence as a candidate writer until source proves whether it marks acknowledgment or creates/updates actions |
| `save_red_plan`, `update_corrective` | app-v11 and corrective HTML; retire alternative plan/status/deadline mutation paths |
| `upload_evidence`, `complete_corrective`, `verify_corrective` | app-v11/corrective/verify HTML; retire unsafely parallel evidence, completion and closure routes plus direct table/storage writes |
| Login/home/queue/detail/all-inspections actions | Names do not prove read-only/authenticated semantics; inspect actual handler/SQL and ensure no identity spoofing, hidden writes or cross-facility reads |
| `morning_checkin`, `morning_checkout`, `complete_onboarding`, `training` and other modules | Remain outside the new corrective engine. Inventory consumers/side effects and ensure they cannot alter protected identity/site/asset state. Preserve or migrate under their own approved policy, not blanket deletion |

PR #12 references `v6_test_take_ownership`,
`v6_test_complete_corrective_action`, and `v6_test_verify_corrective_action`.
Their hosted definitions/grants are not present here. Obtain those plus every route's
actual function mapping; do not infer missing RPC names. Fencing the Edge handler
alone is insufficient if PUBLIC/anon/authenticated can execute a legacy SECURITY
DEFINER RPC directly. Conversely, do not revoke broad privileges or enable RLS on
unknown tables without approved dependency/consumer analysis. Audit default grants,
views, triggers, cron/webhooks, old tabs and storage policies; browser redirects
are not server-side retirement evidence.

## H. Nonproduction migration / end-to-end plan (NOT executed)

1. **Approve access and inventory only.** Verify target, catalog visibility and private
   data minimization. Produce a versioned contract and resolve HC-01–HC-08; record
   versions/hashes and authorized scope. No business RPC login/read probe in production.
2. **Approve protected backup capture and restore rehearsal separately.** Include
   schema/ACLs/RLS/functions/triggers/enums, data/FK/sequence integrity, B23 sessions
   and audit, action history, and all media plus object/ownership metadata. Confirm
   backup/PITR entitlement and retention; encrypt, restrict access and record hashes.
   No backups or raw exports in this public PR. A backup is not usable evidence until
   successfully restored in isolation and media references verified.
3. **Provision/authorize isolated nonproduction resources separately.** Match hosted
   PostgreSQL/pgcrypto/PostgREST/Deno/runtime versions and grants, using sanitized
   relationally consistent fixtures and independent nonproduction bindings. Do not
   copy live credentials/PINs/session tokens, activate integrations or incur paid
   classifier/SMS/email calls. Block external service traffic by default.
4. **Implement approved corrections in a separate engineering change.** Resolve the
   historical-scope snapshot, lifecycle/enums, source-version/mixed-writer fencing,
   reporting and actual API differences. This documentation assessment patches none
   of these and does not promote an unknown state to compatible.
5. **Apply to the isolated clone only after explicit approval.** Validate migration
   ledger and namespace collision before executing; use the verified tool's atomic
   transaction behavior. Seed only the privately approved manifest, verify FK/domain/
   enum/trigger/grant behavior and ensure failure rolls back all objects. Do not drop
   or rerun over pre-existing objects as a shortcut. Record a reviewed schema diff.
6. **Exercise complete role/site flows in nonproduction.** Employee vehicle/plant
   submission (all-pass, multiple deficiencies, explicit ack, retry/failure), both
   manager roles, comments, assignment/transfer/rotation, deadline/time zone handling,
   actual before/after bytes and provenance, rejection/fresh evidence, independent
   closure and reporting/count parity. Reopen a new connection/process and perform a
   real restore test; the previous PGlite snapshot test is not hosted durability proof.
7. **Negative and race matrix:** unauthenticated/spoofed identity/role; direct old/new
   RPC/table/storage bypass; both facilities and tenants; expired/revoked identity;
   moved asset and historical-scope isolation; source edits/actions appearing after
   intake; concurrent assignments/submissions; closed-state immutability; partial
   upload/commit/network failure; absent mappings/counter unavailable; malformed
   evidence/status/enum; self-verification and another open RED asset finding.
   Probes that might write must remain isolated, never production “expected denial”.
8. **Approve cutover rehearsal and report reconciliation separately.** Drain/fence old
   writers/jobs, snapshot source versions, transfer only reviewed classes, compare
   scoped totals and media hashes, prove every report/consumer and stale-client
   failure, and test pause/forward-recovery/rollback. No dual active mutation engines.
9. **Production decision remains separate.** Daniel's explicit approved release path,
   migration/data-custodian approvals and deployment authorization are prerequisites.
   Backends/schema/mappings precede frontend activation; current automatic Pages
   publishing must not be triggered by a merge. This task authorizes none of these.

## I. Backup / rollback gates

Before any later approved change, retain the exact schema/function/frontend versions,
privilege/config snapshots, migration ledger, mapping/crosswalk revisions, source
freeze point and tested backups/media checksums. Agree recovery objectives and who
can authorize a stop. Document restoration of sequence/FK/enum and storage linkage,
not only counts. Quiesce both writer paths before recovery and preserve all post-
cutover writes/audit/media for reconciliation. If data has been created under the new
schema, a frontend revert is not a data rollback. Choose approved forward repair or
restore/replay against the tested plan; do not drop evidence or re-enable an unsafe
anonymous legacy writer. If no safe write path is available, remain read-only with
an owner-approved business-continuity process. No backup, restore or rollback was
performed in this assessment because no hosted access/change occurred.

## J. Deployment-readiness checklist

- [x] PR #13 implementation SHA and report inspected; local/remote identity verified.
- [x] Available access/configuration checked without credential disclosure; metadata
  attempt and proxy-versus-hosted status distinguished.
- [x] Repository contract, retirement inventory, required evidence and reconciliation/
  nonproduction/recovery plan documented; unknown values not fabricated.
- [ ] Authorized hosted catalog/API source/config export obtained with visibility and
  project/version provenance; HC-01 resolved.
- [ ] Real types/constraints/enums/triggers/grants/auth/runtime match an approved
  corrected migration and API contract; all mismatches adjudicated.
- [ ] JK Farms/Borland facility/asset/employee manifests privately approved; no guessed
  IDs or memberships; asset-move/historical isolation corrected and tested.
- [ ] Open/in-progress/pending/closed legacy actions, media/audit and every report
  reconciled with a reviewed source crosswalk and complete counter definition.
- [ ] Old Edge/RPC/table/storage/job write alternatives fenced; direct bypass and
  mixed-writer/race negatives pass in nonproduction.
- [ ] Auth/independent verification and operational return-to-service policy approved;
  no automatic release of an asset with other unresolved restrictions.
- [ ] Protected backups restored successfully, media and privileges verified, and
  forward-recovery/rollback rehearsal accepted.
- [ ] Nonproduction end-to-end and denial matrix pass against the real contract,
  including actual Edge/crypto/token/RLS behavior and failure/restart cases.
- [ ] Daniel and designated data/safety/DB custodians approve the specific changes;
  release-governance prerequisites and backend-before-frontend order satisfied.

**Assessment result: NOT DEPLOYMENT-READY.** Only documentation was updated. The
82/23/38 check counts and CI run above remain historical synthetic evidence for
`5f00361`; no hosted compatibility result, real mapping, live row count, nonproduction
migration or new end-to-end test execution is claimed by this read-only follow-up.

Pinned source references:
- [PR #13 migration](https://github.com/adbrwns8-eng/eim-v6-field-test/blob/5f00361ce60451e99c1c85648d5d0389eb2b9ea4/supabase/migrations/b23_manager_workflow.sql)
- [PR #13 Edge handler](https://github.com/adbrwns8-eng/eim-v6-field-test/blob/5f00361ce60451e99c1c85648d5d0389eb2b9ea4/supabase/functions/b23-manager-workflow/index.ts)
- [PR #13 catalog fixture — synthetic, not hosted DDL](https://github.com/adbrwns8-eng/eim-v6-field-test/blob/5f00361ce60451e99c1c85648d5d0389eb2b9ea4/tests/manager-workflow-fixture.mjs)
- [Legacy manager client at main](https://github.com/adbrwns8-eng/eim-v6-field-test/blob/45a61c83aac0ad521046bcad9a04ed8e8cc35193/app-v11.js)
- [Legacy corrective client at main](https://github.com/adbrwns8-eng/eim-v6-field-test/blob/45a61c83aac0ad521046bcad9a04ed8e8cc35193/corrective.html)
- [Historical routing proposal](https://github.com/adbrwns8-eng/eim-v6-field-test/blob/2f08dbc2c14c723930295dbd04288ecec3ec8cab/BOS-008_MANAGER_ROUTING_PLAN.md)
