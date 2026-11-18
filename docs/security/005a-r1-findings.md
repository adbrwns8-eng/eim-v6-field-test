# BOS 005A-R1 — independent-review follow-up

**Disposition: HOLD. No merge or release authorization.** This is a findings and
remediation-plan change, with offline diagnostic tools. It does not change release
workflows, permissions, CODEOWNERS, application code, dependencies or settings.
Release-code corrections require a separate reviewed implementation assignment.

## Scope, preserved revisions and evidence limits

Reviewed the [independent comment on PR #7][review] and these immutable revisions:

| Item | Verified revision/status |
| --- | --- |
| Main, fetched and checked against origin | `45a61c83aac0ad521046bcad9a04ed8e8cc35193` |
| Draft PR #3, CI foundation | `3349387074b7ca38e870769d54bf2a34f87ff607`, open/draft |
| Draft PR #6, first release candidate | `d05516d945d779cb3c3f559a80e874256108c6b8`, open/draft |
| Draft PR #7, reviewed candidate | `660d9c3b06aa0bbdb1295519747a88ac140f47e7`, open/draft |
| This follow-up | New main-based review branch; does not update any of those PRs |

Read-only metadata was rechecked on 2026-11-18 with existing platform-injected
GitHub authentication. It is not a job-scoped `GITHUB_TOKEN`, and no token values
were read out, copied into artifacts or substituted into a deployment. Repository
metadata is distinct from employee/application data; no production site or Supabase
service was accessed.

[PR #7's run 44385958205][run7] completed successfully on its exact head. That run's
only job was the synthetic security suite, not `prepare` or `deploy`. Its success
does not validate release permissions, approval behavior, OIDC or Pages acceptance.
PR #3's [synthetic/browser run][run3] also succeeded on its own revision; those
results do not transfer to a different integration revision.

The public documentation website and the run-log download were blocked by the
network proxy (HTTP 403). No proxy bypass, log-token reuse, workflow rerun or
credential substitution was attempted. Official schema, documentation data and
action source were instead inspected through their authorized public GitHub
repositories. Log/signed-download URLs are deliberately excluded from this report.

## Findings matrix

Severity describes security/release risk. A fail-closed availability failure is not
an observed unauthorized deployment. “Confirmed” below means code, metadata or
published-contract evidence, not a production experiment.

| ID / severity | Finding and evidence | Status / concrete remediation | Nonproduction verification before release |
| --- | --- | --- | --- |
| R1-01 / P0 | **Approval identity is not provisioned independently.** PRs #3 and #7 are authored by `adbrwns8-eng`; [candidate CODEOWNERS][owners] designates that account. [Policy][policy] requires it as sole environment reviewer and rejects it as original or rerun initiator. Live self-review prevention is false. | Confirmed identity/configuration gap. Retain the overlap rejection. Establish the three-principal model below; never share the owner token, spoof commit authorship or weaken approvals. Owner-authored code-owner PRs need a genuinely independent authorized review path. | Verify actual authenticated PR author, latest pusher, code-owner approver, run actor and environment reviewer using distinct test principals. Demonstrate owner-initiated and self-approved releases are refused. No such exercise performed here. |
| R1-02 / P1 | **Pages request violates the published `artifact_id` type.** The workflow passes an environment string; `deployVerifiedArtifact` posts `expected.id` unchanged. The [official OpenAPI][openapi] declares `artifact_id: number`; the existing stub explicitly accepts a string. | Confirmed schema mismatch, reproduced offline against the exact candidate function. Backend coercion/rejection was not tested; do not claim a real HTTP 422. Propose checked positive safe-integer conversion with exact round-trip equality and schema-enforcing stubs. Keep all ID/run/hash checks. | Offline diagnostic below must expose the original mismatch and a future corrected client must satisfy the official request schema, reject precision loss and preserve the exact verified ID. Any real Pages contract exercise needs separate authorization. |
| R1-03 / P1 | **Artifact shape has partial official support, not end-to-end validation.** The [pinned official packager][uploadpages] makes raw `artifact.tar`, then uploads it with upload-artifact v4. [Pinned uploader code][zipimplementation] uses ZIP transport. Its [README][artifactreadme] nevertheless says gzip and default `github-pages` naming. The [current official packager snapshot][currentuploadpages] still makes raw tar but now pins upload-artifact v7. | The candidate's raw tar is not a confirmed gzip defect. The source supports an inner raw tar, and the upload/deploy interfaces support custom names. Do not add nested gzip or revert to name lookup based only on README wording. Resolve the documentation/transport contract and backend/version assumptions before release; current v7 source alone does not prove v4 service compatibility. | Offline tar and modeled-ZIP structure checks passed. Actual upload service wrapping/digest, immutable-ID download and Pages backend acceptance remain unverified. Use only fabricated site data in a separately authorized nonproduction repository. |
| R1-04 / P1 | **Preparation lacks a documented permission it consumes.** `inspectRelease` reads `/pages`; `prepare` declares only contents/actions read. Official permission data assigns that endpoint `pages: read`. | Confirmed declared-permission mismatch. Actual job response is unknown, including public-repository behavior. Propose either separately approved minimal Pages-read capability or moving this particular read into the already-gated job; retain fail-closed release checks. Do not add Pages-write to preparation or use a PAT/anonymous fallback. | A separately authorized metadata-only job must use the actual original/proposed job-scoped tokens and record status/field presence per endpoint. No deployment/OIDC/production secret, and no privilege broadening in this review. |
| R1-05 / P1 | **No-bypass proof depends on a restricted response field.** The [ruleset endpoint description][openapi] says `bypass_actors` is returned only with write access to the ruleset. Candidate rejects an absent array. Neither release job declares such authority. | Confirmed platform-contract limitation; actual field omission for this job was not executed. HTTP 200 is not proof of complete settings visibility. Keep unknown = deny. Do not give the job administration credentials. Design a separately governed owner-verification/attestation or external release boundary, with explicit freshness and trust rules; do not silently replace the check with a manual checkbox. | Demonstrate read-only-token redaction and refusal, and validate any replacement proof with stale/missing/tampered/revoked-evidence cases. If equivalent proof cannot be obtained under the approved privilege model, the release design remains blocked. |
| R1-06 / P0 | **CI bootstrap can itself deploy.** Main still has [push-to-main Pages publishing][mainpages]; PR #3's CI file is not on main. Current required check is `Synthetic npm and browser tests`, while PR #7 emits only the deployment-gate check. | Confirmed merge-order trap. Do not merge CI first under the old push deployer. Prepare one newly authorized integration candidate containing reviewed CI and the corrected manual gate, or first obtain a separately authorized publishing freeze. Keep PRs #3/#6/#7 intact and protections enabled. | The integration PR must emit both exact check names on its own tested revision, fail on injected test failure, have no privileged PR job and be independently reviewed. No merge was performed. |
| R1-07 / P1 | **Runtime registry is not an executable-workflow inventory.** API lists an active dynamic Pages entry and PR-only workflows absent from main. Pages `build_type` is `workflow`. Candidate treats any unknown active registry entry as fatal. | Confirmed conservative rejection, but not proof of an active legacy publisher. Review actual definitions at deployable refs, configuration and supported legacy retirement. Do not blindly allowlist the dynamic entry or claim it currently publishes merely from `state: active`. | Separately authorized read-only source/config audit followed, if necessary, by an owner-authorized nonproduction negative test. If there is no supported way to retire a historical registry record, redesign the predicate without losing publisher isolation. |
| R1-08 / P1 | **Privileged custom control code is part of the trusted computing base.** Candidate checks out immutable control main in the write/OIDC job and executes [policy/client][policy] plus the verifier. PR #6 has no checkout there and uses official actions. | Confirmed architectural tradeoff, not evidence of exploitation. Candidate improves immutable-ID binding and avoids frontend execution, but needs review of every reachable privileged code path. Prefer a minimal separately pinned verifier/client boundary; compare any official-action alternative against its repeated name lookup and transitive pins. | Test actual payload schema, unexpected API/status/output fields, OIDC/error redaction, ID substitution/deletion and failure before POST. Existing stubs are necessary but insufficient; do not grant release approval from their pass. |
| R1-09 / P1 | **Read/check/approve is not an atomic settings lock.** Main is rechecked, but an administrator can change settings after the final read; environment approval is attached to the workflow revision while the frontend may be an older main ancestor. | Residual governance/race risk. Keep immutable SHA/ID/hash binding and fresh dispatch requirements. Human authorization must explicitly bind frontend SHA, control SHA, artifact ID/digest and manifest digest; define cancellation/revocation and freshness semantics for any external proof. | Inject main/settings changes, stale approval, rerun and artifact replacement in the authorized nonproduction plan. A fixed ID prevents selecting a newer artifact; it cannot prevent an administrator changing the authority model. |

No release defect above was fixed in PR #7 by this review. Its disposition remains
HOLD. A green expected-negative diagnostic is evidence that a defect was reproduced,
not evidence the candidate now satisfies the contract.

## Endpoint-by-endpoint token capability matrix

Source: GitHub's [versioned application-permission documentation data][permissions].
This is the documented permission contract, **not an actual-job access test**.
All actual release-job statuses below remain **NOT EXECUTED** because no authorized
release/diagnostic job was dispatched or added. Cloud metadata HTTP 200 responses
are not substituted for these measurements.

| Operation used by candidate | Documented repository permission | Prepare declaration | Deploy declaration | Additional evidence/limit |
| --- | --- | --- | --- | --- |
| GET git ref | contents read | Present | Present | Exact SHA response still must be validated |
| GET commit | contents read | Present | Present | Do not accept branch/tag resolution instead of exact SHA |
| GET compare | contents read | Present | Present | Must establish main ancestry and correct merge base |
| GET environment | actions read | Present | Present | Check field completeness as well as status |
| GET deployment branch policies | actions read | Present | Present | Paginate; distinguish main branch from a main tag |
| GET effective branch rules | metadata read | Implicit metadata | Implicit metadata | Includes rules from repository/organization sources; candidate refuses unknown provenance |
| GET ruleset | metadata read | Basic read only | Basic read only | `bypass_actors` has stronger field-visibility requirements; see R1-05 |
| GET Pages site | pages read | **Absent** | Covered by pages write | Public behavior and actual job response untested |
| GET workflow registry | actions read | Present | Present | Registry presence does not establish default-branch source/trigger |
| GET run artifacts | actions read | Present | Present | Actual artifact's run/head/digest semantics need contract evidence |
| GET artifact by ID | actions read | Present | Present | Immutable ID/digest/expiry validation required |
| POST Pages deployment | pages write plus valid Actions OIDC | Absent, correctly | Present, protected job only | **Not invoked.** Request type mismatch reproduced with fake API |
| GET Pages deployment status | pages read | Not used | Covered by pages write | Bounded polling; post-submit uncertainty is not rollback |

Do not infer that adding `pages: read` would solve R1-05 or prove all other reads.
The evidence JSON includes the exact documented routes, permission names and
ruleset visibility note, with upstream source revisions.

## Enforceable identity proposal — owner decisions required

These are role labels, **not invented/provisioned GitHub accounts**:

| Role | Required principal / separation | Enforced boundary and evidence needed |
| --- | --- | --- |
| PR author and normal development pusher | A: dedicated development identity | Repository-scoped feature-branch/PR access; no main bypass, settings, approval identity, release dispatch or production secrets. Verify authenticated PR/push identity, not `git user.name` or commit email |
| Code owner and latest-push approver | B: designated human `adbrwns8-eng` | B must differ from PR author and latest pusher. Require CODEOWNERS + stale-review dismissal + latest-push review + conversations resolved; no bypass. B can also be environment reviewer |
| Release initiator | C: separately trusted human release operator | C differs from B and must not be the coding agent. Constrain release to main/manual/exact approved revision; verify original and rerun actors. No borrowed B credential |
| Environment reviewer | B: designated human owner | Sole reviewer under the current proposed policy; self-review prevented, no admin bypass, main-only environment. Reject B-initiated runs rather than permitting self-approval |

If B authors a PR or pushes its final revision, B cannot provide the required
independent approval of that work. Either obtain an explicitly authorized additional
trusted code-owner review model, or prepare a new genuinely A-authored successor PR
for B's review. Preserve the existing drafts; do not rewrite their author identity,
retoken the same account, relax controls or add an untrusted reviewer just to merge.
If no separate identities are available, record an operational blocker and stop.

## Remediation and merge-order plan — no actions executed

1. **Keep HOLD and preserve evidence.** Pin the reviewed source revisions and current
   protection observations. Do not dispatch, merge, close or edit PRs #3/#6/#7.
2. **Owner resolves governance.** Provision/verify A/B/C under a separately authorized
   identity and settings task. Determine how owner-authored bootstrap work receives
   legitimate independent review. No credentials in issues or chat, no shared token.
3. **Assign narrow implementation fixes separately.** Correct numeric artifact ID
   serialization with safe round-trip validation and schema-backed tests; explicitly
   version the API contract. Design a least-privilege replacement for unavailable
   bypass evidence before altering that guard. Decide Pages-read placement without
   broadening privileges here. Define a supported workflow-inventory predicate.
4. **Prepare a new combined integration PR**, preserving all three existing drafts:
   review PR #3's exact CI/browser changes and the corrected release candidate
   together, based on then-current main. Include both check producers on that PR.
   Do not merge PR #3 alone while main's automatic deployer remains active. A
   separately authorized owner publishing freeze is an alternative prerequisite,
   not an action authorized by this review.
5. **Prove required-check availability before settings enforcement.** Require both
   exact GitHub Actions checks only after they exist and pass on the integration
   revision: `Synthetic npm and browser tests` and
   `Deployment gate synthetic security tests`. Inject a synthetic failure and show
   nonzero exit blocks that revision. Never disable the existing check for bootstrap.
   New source content and check provenance matter; a registry entry or an unrelated
   historical successful run is insufficient.
6. **Separately authorize a nonproduction capability/contract exercise.** Use an
   isolated test repository/site with fabricated content, no employee/backend data
   or copied credentials. First run metadata-only jobs with the exact original and
   proposed read permissions; record route/status/redacted-field presence without
   logging tokens, headers, signed URLs or entire responses. No Pages write or OIDC
   is necessary for that phase. If job scope cannot supply the required evidence,
   stop and choose a different approved trust boundary, not a PAT/admin secret.
7. **A deployment contract test is a distinct later authorization.** Only after the
   metadata phase, approve a specific nonproduction dispatch and site mutation.
   Exercise actual upload-v4 transport, digest/ID/run semantics, tar acceptance,
   Pages API types, OIDC, approvals, timing/failures and rollback. This review does
   not create that workflow, acquire OIDC, dispatch it or make any deployment call.
8. **Human acceptance and merge/release decisions remain separate.** Resolve real
   self-review/latest-push/code-owner/check/publisher gaps through owner-controlled
   settings work, then independently verify. Before merging the combined candidate,
   verify the new main push cannot publish through any registered legacy/alternate
   route. Later release approval must bind exact immutable identifiers. No production
   readiness claim follows from the offline tests below.

## Reproducible offline evidence

Two diagnostics were run successfully in this review:

```text
node tools/005a-r1-api-contract.mjs
python3 -B tools/005a-r1-artifact-contract.py
git diff --check
```

- API diagnostic verifies the exact candidate commit, isolates its actual deployment
  function in a sandbox with fake gate/API/OIDC dependencies, captures only ID/type
  and build revision, and confirms the string/number mismatch. The test intentionally
  reproduces the original error; it does not simulate a real HTTP rejection. The
  proposed normalization model passes one positive and seven negative cases.
- Artifact diagnostic loads the exact reviewed packager, creates a temporary Git
  repository containing synthetic frontend assets, packages/verifies its approved
  revision and hashes, and checks 17 readable regular USTAR members (16 assets plus
  manifest), with no links. A modeled ZIP wrapper contains only `artifact.tar` and
  round-trips its bytes. It does not execute the upload action or prove backend
  acceptance. Pinned official action source, not the model, establishes the observed
  raw-tar/ZIP implementation.
- These standalone tools need the reviewed candidate Git object. It was already
  present and its full SHA verified here. A future fresh clone must explicitly fetch
  the preserved PR #7 ref read-only and verify it equals the stated reviewed SHA
  before running; tools never fetch, install dependencies or contact a service.
- Main application tests/browser tests were not rerun: no application/runtime code
  changed in this review. Historical PR #7 synthetic success and PR #3 browser
  success are labeled as historical evidence above, not new test results.
- Actual job-token probes, real upload/download, API acceptance, approvals and
  deployments are **UNRUN**, not passed, skipped-to-pass or assumed successful.

## Privileged-code and operational rollback assessment

PR #7 has positive boundaries: immutable control checkout, no approved frontend
execution in the privileged job, no dependency installation there, late OIDC,
sanitized errors, immutable ID/hash validation and no automatic creation retry.
These do not remove the trust placed in every reachable line of the custom client,
Python verifier, pinned actions/runtime and reviewed control revision.

PR #6's no-checkout privileged job is a smaller custom-code surface, but its official
client [resolves an artifact name][officialdeploy] at deployment time, and its pinned upload-pages
composite contains a mutable upload-artifact v4 dependency. Neither design is
certified by this review. Select a small reviewed trust boundary that preserves
immutable ID/digest binding rather than trading a confirmed guarantee for convenience.

For this review-only PR, rollback is closing it or reverting these report/diagnostic
files; no operational setting/site changes need restoration. For a later authorized
release, retain known-good frontend/control revisions, manifests, artifact IDs/digests
and run/deployment IDs. Roll back through the same independently approved gate or a
reviewed successor restoring frontend blobs while retaining controls. Never re-enable
automatic publishing, bypass approval or remove protections to make rollback work.
Pages rollback does not restore Supabase schema/functions/data. After a create call
followed by status failure, outcome is unknown and needs human inspection, not blind
retry. None of those operations occurred here.

[review]: https://github.com/adbrwns8-eng/eim-v6-field-test/pull/7#issuecomment-6990015648
[run7]: https://github.com/adbrwns8-eng/eim-v6-field-test/actions/runs/44385958205
[run3]: https://github.com/adbrwns8-eng/eim-v6-field-test/actions/runs/43994599512
[owners]: https://github.com/adbrwns8-eng/eim-v6-field-test/blob/660d9c3b06aa0bbdb1295519747a88ac140f47e7/.github/CODEOWNERS
[policy]: https://github.com/adbrwns8-eng/eim-v6-field-test/blob/660d9c3b06aa0bbdb1295519747a88ac140f47e7/scripts/release-policy.cjs
[mainpages]: https://github.com/adbrwns8-eng/eim-v6-field-test/blob/45a61c83aac0ad521046bcad9a04ed8e8cc35193/.github/workflows/pages.yml
[openapi]: https://github.com/github/rest-api-description/blob/c9c95fe34ced05fe076001f5c55704742bc8e7f8/descriptions/api.github.com/api.github.com.json
[permissions]: https://github.com/github/docs/blob/1f9d8455c5531588d858d6e4e1bf194155b5aff1/src/github-apps/data/fpt-2022-11-28/server-to-server-permissions.json
[uploadpages]: https://github.com/actions/upload-pages-artifact/blob/56afc609e74202658d3ffba0e8f6dda462b719fa/action.yml
[zipimplementation]: https://github.com/actions/upload-artifact/blob/ea165f8d65b6e75b540449e92b4886f43607fa02/dist/upload/index.js
[artifactreadme]: https://github.com/actions/upload-pages-artifact/blob/56afc609e74202658d3ffba0e8f6dda462b719fa/README.md
[currentuploadpages]: https://github.com/actions/upload-pages-artifact/blob/5f327015a708106f6f1b7c9a633901af30fe80cb/action.yml
[officialdeploy]: https://github.com/actions/deploy-pages/blob/d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e/src/internal/api-client.js
