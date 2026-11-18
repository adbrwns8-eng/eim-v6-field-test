# ADR 005A-R2A — release authorization architecture

Date: 2026-11-18. **Status: proposed architecture; HOLD for implementation/release.**
Documentation-only. This ADR establishes no signer, key, account, service, settings,
runtime capability or release authorization. It preserves Draft PRs #3, #6, #7 and
#8. Unresolved blockers below stop operational progression; documenting them does
not require bypassing them. No merge, dispatch, deployment, account provisioning,
settings change, production credential use or production data access occurred.

## 1. Decision supplied by the owner

- **Daniel is the sole final human release approver.** An automated verifier or
  fact collector is not another human approver and cannot replace his decision.
- **Jared is the proposed independent human release initiator**, pending his own
  GitHub account and verified access. No Jared username, numeric ID or permission
  is inferred or invented in this ADR.
- **Codex may develop, test and prepare draft PRs; it may neither initiate nor
  approve releases.** A prompt or shared owner identity is not an enforceable boundary.

These decisions identify human roles, not verified credentials. Candidate code
pins `adbrwns8-eng`; Daniel must confirm whether that is his exclusive approval
account and that Codex cannot act through its approval/release authority.

## 2. Evidence ledger: facts, assumptions and unknowns

### Confirmed source and read-only observations

| Evidence | Verified fact / limitation |
| --- | --- |
| [Issue #5][issue] and assignment comment | Isolated remediation/draft review authorized; no merge, release or production work authorized |
| Fetched origin/main and independent remote-ref read | Both `45a61c83aac0ad521046bcad9a04ed8e8cc35193`; this ADR branches from that revision |
| [PR #3][pr3] `3349387074b7ca38e870769d54bf2a34f87ff607` | Draft CI/browser-isolation foundation; historical passing evidence belongs to its revision |
| [PR #6][pr6] `d05516d945d779cb3c3f559a80e874256108c6b8` | Draft integration candidate, official Pages-action path, no privileged checkout |
| [PR #7][pr7] `660d9c3b06aa0bbdb1295519747a88ac140f47e7` | Draft custom immutable-ID gate; privileged control-code trust and API defects remain |
| [PR #8][pr8], [pinned R1 findings][r1], `b3bd10390b3f674a83365221d875014118acedde` | Nine-item findings matrix and offline diagnostics; no actual release-job capability or backend pass |
| Local R2 blocker report, accessible during review | `/workspace/bos-005a-r2-blocker.md`, SHA-256 `1f54c3860ac1075b7230766e4acd61f597d0c4aa802bf10900ab90d6d41d4f50`; stopped at missing verification authority, not at a failed production test |
| Environment metadata rechecked 2026-11-18 | Sole configured reviewer `adbrwns8-eng`; self-review prevention **false**; admin bypass **false**; custom deployment policy contains exactly main branch |
| Ruleset `27423765`, current cloud-authenticated read | Active; visible bypass list empty; stale approvals dismissed; latest-push/code-owner requirements **false**; strict required check `Synthetic npm and browser tests` |
| Pages and current workflow/source inventory | Pages `build_type: workflow`; main has only `pages.yml`, still push/manual. Registry also includes PR-only workflows and active `dynamic/pages/pages-build-deployment` |
| [Official ruleset API description][schema] | `bypass_actors` is returned only with write access to the ruleset; HTTP 200 does not guarantee that field is visible |
| [Official permission data][permissions] | Basic rules read is metadata/read; environment/branch-policy/workflow/artifact reads use actions/read; Pages read uses pages/read |
| [Official Pages request schema][schema] and R1 reproduction | `artifact_id` is a number; PR #7 posts an environment-derived string. Backend coercion/rejection has not been tested |

Cloud GitHub authentication used for metadata is **not** the future job-scoped
`GITHUB_TOKEN`. No cloud credential or observed response is reused as a future
release proof. API metadata reads concerned repository controls, not application data.
The dynamic registry record does not prove an executing legacy publisher: the same
registry contains workflows that exist only on PR branches. Conversely, Actions
source alone does not prove there is no alternate/external publishing route.

### Unproven prerequisites — deny while unknown

Jared's account/access; Daniel's exclusive account mapping; actual agent token
capabilities and authenticated PR/push identity; actual job-token endpoint access
and restricted-field visibility; effective independent review; real approval/OIDC
behavior; Pages artifact/API compatibility; alternate publisher exclusion; any
signing key/issuer, delivery or revocation mechanism; any external controller.
None exists merely because this ADR describes it. No successful API capability is
inferred from a green synthetic suite or from the cloud token's metadata reads.

## 3. Security guarantees and threat model

The proposed acceptance contract is:

1. Jared's **verified** identity requests a specific release; Codex cannot initiate it.
   Daniel alone supplies final human authorization. Neither an agent approval,
   another environment reviewer nor an automatically generated assertion suffices.
2. Authorization binds repository identity, exact reviewed frontend SHA, immutable
   control revision, required-check evidence, artifact ID/hash/manifest, run and
   attempt. Changed content/context requires fresh authorization, never “latest”.
3. Only the gated publishing job obtains Pages-write and OIDC capability. PR code,
   preparation code, Jared's initiation mechanism and Codex do not inherit it.
4. Missing, redacted, inaccessible, stale, revoked or contradictory required evidence
   is a denial. No permissive defaults, anonymous fallback, fabricated identities,
   long-lived admin secrets in Actions or acceptance of a missing bypass list.
5. No unknown alternate publisher, actor bypass or self-approval route is treated as
   safe. If the required guarantee cannot be proved under approved permissions,
   stop; a checklist or signature label does not manufacture enforcement.

**Assets:** authorization identity and audit trail, release-control code, trust
roots/revocation state, exact frontend artifact, Pages/OIDC credentials and repository
protections. Employee/backend data is outside this task and must remain inaccessible.

| Threat / boundary | Required defense / limit |
| --- | --- |
| Compromised Codex/development token or malicious PR/dependency | No release initiation/approval/settings scope; protected control-code review, default read-only CI, no untrusted privileged execution |
| Compromised Jared account | Can request but cannot finally authorize; strict run/target binding and Daniel-only approval; revoke account access and pending authorizations on suspicion |
| Artifact swap, floating ref or manifest forgery | Exact commit resolution and ancestry; immutable ID/run/hash bindings; safe numeric ID; parse/verify archive without executing frontend code |
| Replayed/stale authorization or old workflow rerun | Unique context/nonce, finite lifetime, current policy/revocation checks and fresh approval; reject changed runs/attempts/targets |
| Spoofed reviewer, renamed login or shared owner token | Verify immutable account IDs and current account mapping; no borrowed identities; deny an unverified mapping |
| Redacted ruleset field or failed metadata request | Deny; use an explicitly approved independently verifiable proof only after its authority is real |
| Settings drift and alternative workflow/publisher | Authoritative source/ref/config inventory plus bounded fresh authorization; no registry-only exception; acknowledge reads are not atomic with deployment |
| Compromised Daniel, GitHub control plane or fully privileged administrator | All three designs ultimately trust an authority. They cannot promise safety against that root rewriting its own trust model; owner must explicitly define this threat boundary and incident response |
| Network uncertainty after submitting a deployment | Do not infer no deployment occurred; no blind create retry; require human inspection before another authorization |

“No bypass at a verified snapshot” and “no administrator can ever change a bypass”
are different guarantees. None of A/B/C creates an atomic lock across arbitrary
GitHub administrative changes. This limitation is not permission to ignore unknown
state or silently downgrade the existing requirement.

## 4. Options compared

All rows are **proposals**, not deployed facilities. B/C must retain native protected
publishing/OIDC controls; a signature or external service alone is not a Pages token.

| Dimension | A — GitHub-native environment/ruleset controls | B — independent signed release authorization | C — external owner-controlled authorization boundary |
| --- | --- | --- | --- |
| Trust roots | GitHub account authentication, protected workflow/control revision, environment and ruleset enforcement, trusted owner administration | A plus an independently enrolled Daniel-controlled verification key/identity and current revocation/policy root | A as applicable plus verified external operator/controller, its policy, identity provider, state store and deployment integration |
| Final human authority | Environment review by Daniel only; Jared-only initiation, no self-review/bypass | Daniel signs the exact authorization envelope and remains the only final human approver; native environment review retained | Controller accepts only Daniel's authenticated approval of Jared's verified request; machine executes, never grants itself human authority |
| Signer/identity evidence | GitHub actor/account IDs and pending environment approval, not Git commit email or displayed names | Key fingerprint/issuer mapped to Daniel through independent enrollment; not inferred from a PR, Codex-generated key or a GitHub Actions provenance signature | Real verified service/host and Daniel/Jared login bindings; no imaginary endpoint, account or token |
| Verification | Native gate plus exact-ref/artifact/policy checks | Verify canonical signed payload, audience, context, hashes, issuer/key state, finite freshness and revocation before publishing | Minimal trusted controller validates policy/evidence and authorization; downstream publishing path must reject any request that bypasses it |
| Restricted bypass visibility | Native enforcement can apply rules the job cannot fully read. It does **not** let the job prove the hidden bypass list is empty | An authorized independent collector or Daniel must actually obtain the complete snapshot; signature authenticates that statement, not the truth of inaccessible metadata by itself | Collector may have an explicitly approved protected capability outside CI, but its complete-field access and safe scope must be demonstrated |
| Required privileges | Developer/initiator/reviewer capabilities separated; prepare only documented reads, protected deploy adds pages/write + id-token/write | No admin credential in CI; verifier needs public policy/root and evidence delivery reads. Signer/collector's actual access is separately approved | Dedicated least-privilege controller/collector and possibly dispatch rights; increased secret/privilege surface outside CI, never assumed available |
| Freshness | Run-bound human approval and repeated current metadata reads; no atomic guarantee against later changes | Short, explicitly configured validity; independently sourced timestamps, request-specific nonce/context and fresh policy/revocation reads; no timestamp-only trust | Online decision with bounded lease and current policy, but outages/incomplete reads deny; service clock/state become trusted dependencies |
| Replay | Refuse reruns/changed targets and require fresh run-specific approval; backend exactly-once behavior is not established | Bind repo/run/attempt/artifact; enforce single-use state or prove equivalent run lifecycle constraints. No automatic POST retry | Durable atomic nonce consumption/authorization receipt can help, but exactly-once external side effects still need a verified API contract |
| Revocation | Daniel rejects/cancels pending approvals and authorized administrators revoke access/settings; completed deployment is not undone automatically | Daniel revokes key/ticket/policy through an authenticated fresh channel; cached old key lists cannot count as current revocation evidence | Controller denies revoked identity/key/ticket and revokes leases; remove its own credentials if compromised; independent recovery is necessary |
| Operational cost | Lowest infrastructure; ongoing reviewer/capability/config audits and on-call recovery still required | Medium: secure key custody, enrollment, recovery/rotation, delivery, freshness and replay/revocation procedures | Highest: deployment/patching, availability, durable state, identity integration, credential custody, audit and incident response |
| Principal failure modes | Shared identity, overly broad agent rights, administrator bypass, missing checks, self-review or hidden metadata | Agent-controlled key, stale/replayed evidence, wrong audience, permissive parsing, untrusted clock, inaccessible revocation, signature over incomplete facts | Confused deputy, service compromise, outage, issuer drift, stale state, direct publisher bypass or an unsupported GitHub OIDC/artifact integration |
| Enforceable today with evidenced job permissions? | **Not the full contract.** Native approval is a plausible base; current settings/identities are unsafe/unverified and strict bypass proof is unavailable | **No current authority/root exists.** Cryptographic verification could avoid giving CI ruleset-write access, but collection authority, keys, delivery and revocation remain unprovisioned/unverified | **No.** No independent controller, credential or compatible publishing integration has been established |

### A: smallest enforcement base, not a cure for redacted metadata

Native environment rules are valuable precisely because they run before the
publishing job receives privileges. The owner decision is compatible with Daniel as
sole required reviewer, self-review prevented, bypass disabled, main-only deployment
and Jared-only initiation. Actual GitHub/token permission coupling must still be
verified: developer repository write access or the ability to propose workflow files
is not proof that a particular token cannot dispatch or approve a release.

The job should consume only documented reads: contents/read for refs/commits, actions/read
for environment/branch-policy/workflow/artifact metadata, and pages/read where needed.
Ruleset basic read does not guarantee `bypass_actors`. Granting Pages-read cannot fix
that field-visibility restriction. Do not add an administrator credential or simply
delete the no-bypass assertion. Trusting native administration instead of proving
the required snapshot would be a distinct assurance decision, not this ADR's default.

Prefer doing the Pages configuration read in the protected job where Pages-write
already covers read, if the approved phase design permits it. A pre-gate Pages read
would need a separately approved pages/read grant, never Pages-write in preparation.
Neither choice proves actual job capability without its authorized metadata test.

### B: distinguish factual evidence, human authorization and build provenance

Daniel's user-designated approval authority is confirmed; a signing key or signing
capability is **not**. No key or issuer was created for this ADR. A future design
could use Daniel's independently enrolled signing capability to authorize a complete,
independently verified settings snapshot and immutable release context. Codex may
prepare untrusted evidence, but cannot vouch for its truth or sign Daniel's decision.

A proposed envelope must bind repository numeric identity and audience/purpose,
frontend/control SHAs, workflow/ref, initiating Jared account ID, run/attempt,
artifact ID/digest and manifest, exact policy/check/settings evidence identifiers,
issuer/key ID, nonce, issue time and finite expiry. Signature verification must cover
the full canonical payload and reject duplicate/ambiguous fields and algorithm
substitution. A build/provenance attestation signed by an Actions workload proves
neither Daniel's approval nor a complete bypass inventory.

Daniel or a separately authorized fact collector must have demonstrated full-view
access. A signed assertion containing “unknown” or an omitted bypass list still
denies release. A signature is not remote-state measurement, and freshness cannot
prove that an administrator never changed settings after measurement.

Delivery may be untrusted if signatures and context are checked, but a real delivery
path with supported job-token reads must be selected and tested. No service,
authorization branch, artifact-upload facility or cross-run Pages capability is
assumed. In particular, a same-run approval cannot depend on magically changing
immutable dispatch inputs after preparation. An approved design must provide a
real post-preparation evidence-delivery/resume protocol or explicitly validate a
different phase structure and its backend contracts.

Revocation needs more than a static list embedded in an old workflow. One design to
evaluate is a currently readable protected policy version whose update invalidates
pending runs; verify its fresh head/version before publishing and deny unreadable
state. This is not implemented and is not an atomic revocation guarantee. Key/ticket
revocation, maximum age, clock tolerance and nonce consumption need explicit owner
decisions and tests. No lifetime or algorithm is invented as an already-approved policy.

### C: isolation benefit only if the publishing capability is actually outside Codex

An owner-controlled boundary could reduce trust in repository-developed privileged
code and centralize proof/revocation. It would need a real operator and enforceable
denial of direct alternative publishing paths; moving an endpoint while leaving an
agent-controlled Pages token available would not isolate authorization.

An external signer/token does **not** automatically satisfy GitHub Pages' Actions
OIDC requirements. A controller may need a protected native workflow, and the
artifact/repository/run/issuer bindings must be validated. Neither arbitrary external
OIDC nor cross-repository/cross-run artifact acceptance has been demonstrated.
If a machine dispatches on behalf of Jared, preserve Jared's authenticated request
identity and audit binding; an app's technical dispatch identity is not proof Jared
initiated it. Any change to the intended actor policy requires explicit review.

No host, independent service, administrative credential or successful API access
is assumed available. Introducing one requires a separately authorized project and
raises operating and recovery obligations beyond the current evidence.

## 5. Recommendation and decision boundary

**Recommend A as the mandatory enforcement base, with a narrowly scoped B proof
extension as the simplest candidate capable of addressing the retained restricted
bypass-evidence requirement. Do not select C merely to conceal an unresolved proof.**

A is the lowest-cost human-approval mechanism, but A alone cannot claim the full
current contract with the evidenced job permissions. B could make a verified
Daniel-controlled authorization independently checkable without placing a ruleset
administrator credential in the job. That is a conditional architecture choice,
not an assertion that Daniel has agreed to key custody or that the proof issuer,
revocation/delivery mechanism or full-view collector exists.

**None of A/B/C is operationally demonstrated viable today.** Stop at this ADR until
Daniel approves the actual trust-root and proof protocol and Jared's own identity
and access are verified. If B's collection, delivery or revocation cannot satisfy
the contract, keep release denied and evaluate C as a separately specified boundary.
Do not silently reduce the assurance requirement to make A appear sufficient.

## 6. Identity and permission matrix

All grants below are proposed requirements, not actions taken or capabilities proved.

| Principal/component | Allowed purpose | Required separation / permission limits | Evidence before use |
| --- | --- | --- | --- |
| Daniel | Sole final human release approval; owner decisions; possible B signer only after enrollment approval | Exclusive approval identity; no lending to Codex/Jared; no self-approval of his own initiation; signing private material unavailable to CI/agent | Confirm account numeric ID/mapping, exclusive control and authentication/recovery; verify native approval and any signing root independently |
| Jared | Proposed human release initiation | His own verified account; no final approval, signer-key custody, admin bypass or grant of Pages credentials merely to request | Verify account/access, authenticated actor ID and required dispatch capability; none assumed from his name |
| Codex development identity | Feature-branch code, tests, draft PRs/evidence | Repository-scoped grants with branch restrictions enforced by rulesets; no initiation/approval/settings/Pages authority, no human credentials. A token is not automatically branch-scoped | Inspect effective App/token grants and authenticated PR/push identity; separately authorized negative capability tests; same owner-looking author is not independence |
| PR CI and preparation | Synthetic tests, immutable data-only packaging | Minimum documented reads; no Pages-write/OIDC/production secrets or approval authority | Exact permission manifest, both CI producers, real job-token metadata contract under separate authorization |
| Protected publisher | Publish only the verified, authorized artifact | Ephemeral pages/write + id-token/write only after native gate; minimal read scopes; no ruleset administrator secret; trusted minimal immutable verifier/client | Gate review, schema/negative tests and separately authorized nonproduction proof of API/OIDC and permissions |
| B collector/verifier, if chosen | Complete settings evidence / public verification | Collector authority separate from Codex; verifier holds public roots only; automated fact collection is not final human approval | Identify actual collector, demonstrate field visibility and root enrollment; freshness/revocation/delivery protocol approved |
| C controller, if chosen | Mediate Daniel-authorized Jared request | Owner-controlled credential/state and minimal publisher integration; no self-authorizing service or hidden agent fallback | Real service/identity/rights, failure/recovery model and downstream exclusivity demonstrated before introduction |

PR author/code-owner/latest-push review is a separate duty from final release
approval. Daniel-authored infrastructure PRs cannot be made independent by his own
approval. Use a genuinely separate verified development PR author with Daniel's
review, or separately authorize an additional code-review arrangement. Jared's
proposed release-initiation role does not automatically make him a code owner.
No existing draft is edited to pretend this issue has been resolved.

## 7. Evidence gates and offline test plan

| Gate | Required evidence / offline negative cases | What remains outside offline proof |
| --- | --- | --- |
| Identity | Fixtures for mismatched account IDs, rename/stale mapping, shared identity, Codex actor, Daniel initiation and unverified Jared; all deny | Actual account provisioning/access, nondelegation and negative API capability tests |
| Source/CI integrity | Both exact CI check producers, real YAML parsing, no push/PR deployment path or privileged PR tokens; failing test/changed head must deny | Effective required checks and review enforcement on actual integration PR |
| Exact artifact/API | Number-typed positive safe integer ID with exact round trip; reject overflow/fractions/signs/whitespace, wrong repo/run/attempt/SHA/digest, archive traversal/links/duplicates | Backend artifact wrapping, Pages ID/OIDC acceptance and actual status behavior |
| B trust root, if selected | Synthetic test keys only: unknown/revoked issuer, agent-created root, wrong audience/algorithm, duplicate fields, altered signature or payload all deny | Daniel's real enrollment/key custody and authenticated recovery; no synthetic key promoted into production |
| Evidence completeness | Redacted/absent bypass list, wrong rule IDs, missing environment fields, unsupported provenance, failed pagination and API 403/timeout all deny | Complete-field access with the actual authorized collector/job token |
| Freshness/revocation/replay | Expired/future timestamps, unavailable clock/revocation, stale policy version, duplicate nonce, old attempt, changed artifact, revoked key/ticket and replay into another repository/run all deny | Actual durable single-use mechanism or proven native lifecycle equivalent; no assumed exactly-once Pages POST |
| Dynamic publisher inventory | Registry-only/historical entries cannot alone prove publication; mismatching Pages source or an unexplained executable publisher denies; no unconditional dynamic-path exception | Supported platform semantics and absence of external/legacy publishing routes |
| Privileged boundary | Verify no approved frontend execution; test error/output redaction and signature-verified exact-ID request; simulate changes between reads and submission | Atomicity limits, malicious administrators, real platform behavior |
| Recovery | Simulate rejected approval, revocation, partial submission, ambiguous timeout and unavailable proof; require stop and human inspection | Actual approved nonproduction cancellation/rollback and retained artifact recovery |

This documentation task ran no application/security test suite and no contract,
metadata-probe or deployment workflow. The table is a plan, not results. Historical
R1 synthetic diagnostics and PR CI passes are recorded only as historical evidence.

## 8. Bootstrap, release and rollback sequence — description, not authorization

1. **HOLD today.** Preserve all drafts and exact evidence. No merge of even a
   documentation/CI-only PR into today's main is assumed deployment-free: main
   still has automatic publishing. Resolve who can independently review bootstrap
   changes without borrowing Daniel's identity or disabling protections.
2. **Owner decisions/provisioning under separate authorization.** Verify Jared and
   Daniel account mappings; constrain Codex grants; choose and provision the B
   root/collector/delivery/revocation design if selected. No credentials in chat,
   source or CI secrets as a shortcut. If unavailable, stop rather than manufacture proof.
3. **New corrected combined candidate.** Integrate reviewed PR #3 CI/browser
   protections, corrected release controls and both exact check producers in a new
   independently reviewed PR. Keep #3/#6/#7/#8 unchanged. Correct numeric ID and
   schema-backed tests; define least-privilege read placement and an enforceable
   publisher-inventory predicate. Do not merge CI alone under the old deployer.
4. **Prove before enforcing/merging.** Both `Synthetic npm and browser tests` and
   `Deployment gate synthetic security tests` must run on the integration revision
   with negative/failure cases. Separately authorized owner settings verification
   must show independent review, self-review prevention, no bypass and no alternate
   publishing path; missing evidence remains denial. Do not disable checks for bootstrap.
5. **Authorized nonproduction validation only later.** First obtain real job-token
   metadata/field capability evidence with no publish privilege. A distinct later
   authorization is needed for artifact/OIDC/API and human approval/cancellation
   tests in an isolated synthetic-data site. No dispatch is performed by this ADR.
6. **Merge only under separate explicit approval.** Verify the merge cannot publish
   automatically through the new workflow or a legacy path. A separately approved
   owner publishing freeze is an alternative prerequisite, not permission granted
   here. Preserve known-good configuration/revision evidence before any change.
7. **Later authorized release.** Verified Jared initiates the exact request; Daniel
   verifies the immutable artifact/context and supplies final authorization through
   the approved design. Publisher rejects unknowns, revalidates the bound proof and
   submits only the exact verified ID. No retry or reuse after changed context.
8. **Rollback is another release.** Retain known-good frontend/control SHAs, artifact
   ID/digests/manifest, authorization and run/deployment IDs before first release.
   Jared requests the exact known-good revision and Daniel alone authorizes it under
   the same current gate/proof. Revoke/cancel pending tickets as supported; do not
   assume expiration undoes a completed publication. Never restore auto-publishing,
   relax approval, bypass unknown metadata or use a floating branch to recover.
   Pages frontend rollback does not restore Supabase schemas/functions/data.
9. **Incident uncertainty.** After ambiguous submission or suspected identity/key
   compromise, stop new requests, preserve audit evidence and require Daniel's
   authorized inspection/recovery. If Jared is unavailable, no alternate initiator
   or shared-account emergency bypass is implied. Closing this ADR draft needs no
   operational rollback because it changes no live control.

## 9. Explicit owner decisions and unresolved blockers

- Confirm Daniel's exclusive GitHub account mapping and Jared's own verified account
  and actual required access. Neither has been established by this document.
- Approve or reject the conditional A+B target. The recommendation does not appoint
  an active signer or authorize implementation, deployment or setting changes.
- If B is chosen, identify the real full-view collector, Daniel's signing enrollment,
  public-root protection, storage/delivery protocol, finite validity/clock policy,
  replay state, live revocation and key recovery. Nothing missing may default to allow.
- State the trusted-administrator/platform threat boundary and what constitutes a
  complete current bypass proof. A signature alone or partial API response is not it;
  continuous atomic protection against an all-powerful administrator is not promised.
- Resolve the current identity/review deadlock and required-check bootstrap without
  modifying preserved PRs or weakening protections. Confirm agent capability limits
  using actual credentials only in a separately authorized nonproduction test.
- Approve future least-privilege job-token diagnostics and, separately, any backend
  compatibility/approval/rollback exercise. Unknown capability is still unknown.
- Resolve real dynamic/legacy/external publishing semantics. An active registry
  record alone establishes neither a bypass nor its safe retirement.

**Stop state:** account separation, bypass-proof authority, delivery/revocation and
actual token/backend capabilities remain unresolved security blockers. No release
implementation or operational action should proceed from this ADR. The permitted
deliverable is this documentation-only draft for Daniel's architecture decision.

[issue]: https://github.com/adbrwns8-eng/eim-v6-field-test/issues/5
[pr3]: https://github.com/adbrwns8-eng/eim-v6-field-test/pull/3
[pr6]: https://github.com/adbrwns8-eng/eim-v6-field-test/pull/6
[pr7]: https://github.com/adbrwns8-eng/eim-v6-field-test/pull/7
[pr8]: https://github.com/adbrwns8-eng/eim-v6-field-test/pull/8
[r1]: https://github.com/adbrwns8-eng/eim-v6-field-test/blob/b3bd10390b3f674a83365221d875014118acedde/docs/security/005a-r1-findings.md
[schema]: https://github.com/github/rest-api-description/blob/c9c95fe34ced05fe076001f5c55704742bc8e7f8/descriptions/api.github.com/api.github.com.json
[permissions]: https://github.com/github/docs/blob/1f9d8455c5531588d858d6e4e1bf194155b5aff1/src/github-apps/data/fpt-2022-11-28/server-to-server-permissions.json
