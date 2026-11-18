'use strict';

// API errors are fatal; there is no permissive fallback.
const REPOSITORY = 'adbrwns8-eng/eim-v6-field-test';
const REQUIRED_CHECKS = ['Synthetic npm and browser tests', 'Deployment gate synthetic security tests'];
const WORKFLOWS = new Set(['.github/workflows/pages.yml', '.github/workflows/pr-ci.yml', '.github/workflows/deployment-gate-tests.yml']);
const SHA = /^[0-9a-f]{40}$/;
const isSha = value => typeof value === 'string' && value.length === 40 && SHA.test(value);
function requireSafe(condition, message) {
  if (!condition) throw new Error(`Release blocked: ${message}`);
}
async function safeApi(call) {
  try { return await call(); }
  catch (error) {
    // Octokit errors may retain request headers/body. Never propagate those objects.
    const status = Number.isInteger(error.status) ? error.status : 'unavailable';
    throw new Error(`Release blocked: GitHub API request failed (HTTP ${status})`);
  }
}
function validateDispatch({repository, eventName, ref, workflowRef, workflowSha, approvedSha, actor, triggeringActor, runAttempt}) {
  requireSafe(repository === REPOSITORY, 'unexpected repository');
  requireSafe(eventName === 'workflow_dispatch' && ref === 'refs/heads/main', 'manual main dispatch required');
  requireSafe(workflowRef === `${REPOSITORY}/.github/workflows/pages.yml@refs/heads/main`, 'unexpected workflow source');
  requireSafe(isSha(approvedSha) && isSha(workflowSha), 'full lowercase 40-character SHA required');
  requireSafe(String(runAttempt) === '1', 'reruns forbidden; a fresh dispatch and approval are required');
  requireSafe(actor && triggeringActor, 'initiating identities unavailable');
}
function validateRevision({approvedSha, workflowSha, mainSha, commitSha, comparison}) {
  requireSafe(isSha(approvedSha) && isSha(workflowSha), 'invalid revision');
  requireSafe(mainSha === workflowSha, 'main changed since dispatch; start a fresh reviewed run');
  requireSafe(commitSha === approvedSha, 'commit resolution differs from approved SHA');
  requireSafe(comparison && ['ahead', 'identical'].includes(comparison.status) &&
    comparison.merge_base_commit?.sha === approvedSha, 'approved commit must be an ancestor of main');
}
function validateSettings({environment, branches, pages, rules, rulesets, workflows}, {actor, triggeringActor}) {
  requireSafe(environment?.name === 'github-pages' && environment.can_admins_bypass === false, 'environment/admin bypass configuration unsafe');
  const reviewers = environment.protection_rules?.find(rule => rule.type === 'required_reviewers');
  requireSafe(reviewers?.prevent_self_review === true, 'environment must prevent self-review');
  requireSafe(reviewers.reviewers?.length === 1 && reviewers.reviewers.some(entry => entry.type === 'User' &&
    entry.reviewer?.type === 'User' && entry.reviewer.login === 'adbrwns8-eng' &&
    ![actor, triggeringActor].includes(entry.reviewer.login)), 'separate designated human reviewer required');
  requireSafe(environment.deployment_branch_policy?.custom_branch_policies === true &&
    environment.deployment_branch_policy.protected_branches === false, 'explicit main-only environment policy required');
  requireSafe(branches?.length === 1 && branches[0].name === 'main' && branches[0].type === 'branch', 'only main may deploy');
  requireSafe(pages?.build_type === 'workflow', 'legacy branch publishing must be disabled');
  requireSafe(Array.isArray(rules) && Array.isArray(rulesets) && rulesets.length > 0, 'main protections unavailable');
  requireSafe(rulesets.every(rule => rule.enforcement === 'active' && Array.isArray(rule.bypass_actors) && rule.bypass_actors.length === 0), 'active main rules must have no bypass actors');
  requireSafe(['deletion', 'non_fast_forward'].every(type => rules.some(rule => rule.type === type)), 'main must forbid deletion and force pushes');
  const review = rules.find(rule => rule.type === 'pull_request')?.parameters;
  requireSafe(review?.required_approving_review_count >= 1 && review.dismiss_stale_reviews_on_push === true &&
    review.require_last_push_approval === true && review.require_code_owner_review === true &&
    review.required_review_thread_resolution === true, 'independent current code-owner review required');
  const checks = rules.find(rule => rule.type === 'required_status_checks')?.parameters;
  requireSafe(checks?.strict_required_status_checks_policy === true && REQUIRED_CHECKS.every(name =>
    checks.required_status_checks?.some(check => check.context === name && check.integration_id === 15368)), 'both GitHub Actions synthetic checks must be required');
  requireSafe(Array.isArray(workflows) && workflows.length > 0 && workflows.every(workflow =>
    workflow.state !== 'active' || WORKFLOWS.has(workflow.path)), 'unrecognized active workflow or legacy Pages path');
  requireSafe([...WORKFLOWS].every(path => workflows.some(workflow => workflow.path === path && workflow.state === 'active')), 'required workflow inventory incomplete');
}
function validateArtifact(artifact, expected) {
  requireSafe(/^[1-9][0-9]*$/.test(String(expected.id)) && expected.digest?.length === 64 && /^[0-9a-f]{64}$/.test(expected.digest), 'artifact outputs missing or invalid');
  requireSafe(artifact && String(artifact.id) === String(expected.id) && artifact.name === expected.name &&
    artifact.expired === false && artifact.digest === `sha256:${expected.digest}` &&
    String(artifact.workflow_run?.id) === String(expected.runId) &&
    artifact.workflow_run?.head_sha === expected.workflowSha, 'artifact identity, digest or workflow revision mismatch');
}
async function inspectRelease({github, context, approvedSha, triggeringActor}) {
  const repository = `${context.repo.owner}/${context.repo.repo}`;
  const workflowSha = process.env.WORKFLOW_SHA;
  validateDispatch({repository, eventName: context.eventName, ref: context.ref,
    workflowRef: process.env.WORKFLOW_REF, workflowSha, approvedSha, actor: context.actor, triggeringActor, runAttempt: process.env.RUN_ATTEMPT});
  const root = `/repos/${repository}`;
  const get = async path => (await safeApi(() => github.request(`GET ${root}${path}`))).data;
  const paginate = path => safeApi(() => github.paginate(`GET ${root}${path}`, {per_page: 100}));
  const main = await get('/git/ref/heads/main');
  const commit = await get(`/commits/${approvedSha}`);
  const comparison = await get(`/compare/${approvedSha}...${workflowSha}`);
  validateRevision({approvedSha, workflowSha, mainSha: main.object?.sha, commitSha: commit.sha, comparison});
  const environment = await get('/environments/github-pages');
  const branches = await paginate('/environments/github-pages/deployment-branch-policies');
  const pages = await get('/pages');
  const rules = await paginate('/rules/branches/main');
  requireSafe(rules.every(rule => rule.ruleset_source_type === 'Repository'), 'nonrepository rule provenance needs separate review');
  const ids = [...new Set(rules.map(rule => rule.ruleset_id))];
  const rulesets = await Promise.all(ids.map(id => get(`/rulesets/${id}`)));
  const workflows = await paginate('/actions/workflows');
  validateSettings({environment, branches, pages, rules, rulesets, workflows}, {actor: context.actor, triggeringActor});
  requireSafe((await get('/git/ref/heads/main')).object?.sha === workflowSha, 'main moved during validation');
  return {approvedSha, workflowSha};
}
async function deployVerifiedArtifact({github, context, core, approvedSha, triggeringActor, expected,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), pollLimit = 60}) {
  // Called only AFTER the protected job has verified the downloaded tar bytes.
  await inspectRelease({github, context, approvedSha, triggeringActor});
  const artifact = (await safeApi(() => github.request('GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}', {
    ...context.repo, artifact_id: expected.id,
  }))).data;
  validateArtifact(artifact, {...expected, runId: context.runId, workflowSha: process.env.WORKFLOW_SHA});
  let idToken;
  try { idToken = await core.getIDToken(); }
  catch { throw new Error('Release blocked: OIDC unavailable'); }
  requireSafe(typeof idToken === 'string' && idToken.length > 0, 'OIDC unavailable');
  core.setSecret(idToken);
  const deployment = (await safeApi(() => github.request('POST /repos/{owner}/{repo}/pages/deployments', {
    ...context.repo, artifact_id: expected.id, pages_build_version: approvedSha, oidc_token: idToken,
  }))).data;
  requireSafe((Number.isSafeInteger(deployment.id) && deployment.id > 0) ||
    (typeof deployment.id === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(deployment.id)), 'deployment ID missing; outcome requires human inspection');
  for (let attempt = 0; attempt < pollLimit; attempt++) {
    const result = (await safeApi(() => github.request('GET /repos/{owner}/{repo}/pages/deployments/{deployment_id}', {
      ...context.repo, deployment_id: deployment.id,
    }))).data;
    if (result.status === 'succeed') {
      requireSafe(typeof deployment.page_url === 'string' && deployment.page_url.startsWith('https://adbrwns8-eng.github.io/eim-v6-field-test/'), 'unexpected Pages URL');
      core.setOutput('page_url', deployment.page_url);
      return;
    }
    requireSafe(!['deployment_failed', 'deployment_perms_error', 'deployment_content_failed', 'deployment_cancelled', 'deployment_lost'].includes(result.status), 'Pages deployment reported failure');
    if (attempt + 1 < pollLimit) await sleep(10000);
  }
  throw new Error('Release status timed out; do not retry automatically; human inspection required');
}
module.exports = {REPOSITORY, REQUIRED_CHECKS, WORKFLOWS, validateDispatch, validateRevision, validateSettings, validateArtifact, inspectRelease, deployVerifiedArtifact};
