import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile, readdir} from 'node:fs/promises';
import YAML from 'yaml';
import policy from '../scripts/release-policy.cjs';

const A = 'a'.repeat(40), B = 'b'.repeat(40), D = 'd'.repeat(64);
const dispatch = () => ({repository: policy.REPOSITORY, eventName: 'workflow_dispatch', ref: 'refs/heads/main',
  workflowRef: `${policy.REPOSITORY}/.github/workflows/pages.yml@refs/heads/main`, workflowSha: B,
  approvedSha: A, actor: 'synthetic-release-operator', triggeringActor: 'synthetic-release-operator', runAttempt: '1'});
const revision = () => ({approvedSha: A, workflowSha: B, mainSha: B, commitSha: A,
  comparison: {status: 'ahead', merge_base_commit: {sha: A}}});
const settings = () => ({
  environment: {name: 'github-pages', can_admins_bypass: false,
    deployment_branch_policy: {custom_branch_policies: true, protected_branches: false},
    protection_rules: [{type: 'required_reviewers', prevent_self_review: true,
      reviewers: [{type: 'User', reviewer: {type: 'User', login: 'adbrwns8-eng'}}]}]},
  branches: [{name: 'main', type: 'branch'}], pages: {build_type: 'workflow'},
  rules: [{type: 'deletion'}, {type: 'non_fast_forward'}, {type: 'pull_request', parameters: {
    required_approving_review_count: 1, dismiss_stale_reviews_on_push: true, require_last_push_approval: true,
    require_code_owner_review: true, required_review_thread_resolution: true}},
  {type: 'required_status_checks', parameters: {strict_required_status_checks_policy: true,
    required_status_checks: policy.REQUIRED_CHECKS.map(context => ({context, integration_id: 15368}))}}],
  rulesets: [{enforcement: 'active', bypass_actors: []}],
  workflows: [...policy.WORKFLOWS].map(path => ({path, state: 'active'})),
});

test('manual main dispatch and an exact ancestor commit are accepted', () => {
  policy.validateDispatch(dispatch()); policy.validateRevision(revision());
  policy.validateRevision({...revision(), approvedSha: B, commitSha: B, comparison: {status: 'identical', merge_base_commit: {sha: B}}});
  policy.validateSettings(settings(), dispatch());
});
for (const approvedSha of ['', 'main', 'v1', A.slice(0, 7), A.toUpperCase(), A + '\n', ' ' + A, A + ' ', '${{ secrets.TOKEN }}', '$(touch /tmp/no)', '-'.repeat(40)]) {
  test(`reject malformed approved SHA ${JSON.stringify(approvedSha)}`, () => {
    assert.throws(() => policy.validateDispatch({...dispatch(), approvedSha}), /full lowercase/);
  });
}
for (const eventName of ['push', 'pull_request', 'pull_request_target', 'workflow_run', 'schedule']) {
  test(`reject ${eventName} deployment`, () => assert.throws(() => policy.validateDispatch({...dispatch(), eventName}), /manual main/));
}
for (const [name, change] of [
  ['feature branch', {ref: 'refs/heads/bos/test'}], ['tag', {ref: 'refs/tags/main'}],
  ['foreign repository', {repository: 'foreign/repository'}], ['foreign workflow', {workflowRef: 'other'}],
  ['rerun', {runAttempt: '2'}], ['unknown identity', {actor: ''}], ['missing workflow SHA', {workflowSha: ''}],
]) test(`reject ${name}`, () => assert.throws(() => policy.validateDispatch({...dispatch(), ...change}), /Release blocked/));
for (const [name, change] of [
  ['main moved', {mainSha: A}], ['resolved SHA changed', {commitSha: B}],
  ['diverged history', {comparison: {status: 'diverged', merge_base_commit: {sha: A}}}],
  ['commit ahead of main', {comparison: {status: 'behind', merge_base_commit: {sha: B}}}],
  ['incorrect merge base', {comparison: {status: 'ahead', merge_base_commit: {sha: B}}}],
  ['missing comparison', {comparison: null}],
]) test(`reject revision: ${name}`, () => assert.throws(() => policy.validateRevision({...revision(), ...change}), /Release blocked/));

const unsafeSettings = [
  ['self-review', s => s.environment.protection_rules[0].prevent_self_review = false],
  ['no reviewers', s => s.environment.protection_rules = []],
  ['wrong reviewer', s => s.environment.protection_rules[0].reviewers[0].reviewer.login = 'someone-else'],
  ['bot reviewer', s => s.environment.protection_rules[0].reviewers[0].reviewer.type = 'Bot'],
  ['alternate approval identity', s => s.environment.protection_rules[0].reviewers.push({type: 'User', reviewer: {type: 'User', login: 'another-user'}})],
  ['admin bypass', s => s.environment.can_admins_bypass = true],
  ['unknown admin bypass', s => delete s.environment.can_admins_bypass],
  ['wildcard branch', s => s.branches[0].name = '*'],
  ['main tag', s => s.branches[0].type = 'tag'],
  ['additional branch', s => s.branches.push({name: 'release', type: 'branch'})],
  ['all protected branches', s => s.environment.deployment_branch_policy = {protected_branches: true}],
  ['legacy publishing', s => s.pages.build_type = 'legacy'],
  ['ruleset bypass', s => s.rulesets[0].bypass_actors.push({actor_type: 'Integration'})],
  ['disabled rules', s => s.rulesets[0].enforcement = 'disabled'],
  ['unknown bypass actors', s => delete s.rulesets[0].bypass_actors],
  ['no main rules', s => s.rules = []],
  ['no latest-push approval', s => s.rules[2].parameters.require_last_push_approval = false],
  ['no code-owner approval', s => s.rules[2].parameters.require_code_owner_review = false],
  ['stale approval retained', s => s.rules[2].parameters.dismiss_stale_reviews_on_push = false],
  ['check missing', s => s.rules[3].parameters.required_status_checks.pop()],
  ['wrong check producer', s => s.rules[3].parameters.required_status_checks[0].integration_id = 1],
  ['nonstrict checks', s => s.rules[3].parameters.strict_required_status_checks_policy = false],
  ['alternate active workflow', s => s.workflows.push({path: '.github/workflows/other.yml', state: 'active'})],
  ['active legacy Pages entry', s => s.workflows.push({path: 'dynamic/pages/pages-build-deployment', state: 'active'})],
  ['missing CI workflow', s => s.workflows.pop()],
];
for (const [name, mutate] of unsafeSettings) test(`fail closed on ${name}`, () => {
  const s = settings(); mutate(s); assert.throws(() => policy.validateSettings(s, dispatch()), /Release blocked/);
});
test('initiator and rerun actor cannot be the designated reviewer', () => {
  for (const key of ['actor', 'triggeringActor']) assert.throws(() => policy.validateSettings(settings(), {...dispatch(), [key]: 'adbrwns8-eng'}), /separate designated/);
});

const expectedArtifact = () => ({id: '42', name: 'pages-7-1-' + A, digest: D, runId: 7, workflowSha: B});
const artifact = () => ({id: 42, name: 'pages-7-1-' + A, digest: 'sha256:' + D, expired: false, workflow_run: {id: 7, head_sha: B}});
test('accept exact numeric artifact metadata from this run and workflow SHA', () => policy.validateArtifact(artifact(), expectedArtifact()));
test('reject a string artifact ID in GitHub API metadata', () =>
  assert.throws(() => policy.validateArtifact({...artifact(), id: '42'}, expectedArtifact()), /artifact identity/));
for (const id of ['0', '01', '9007199254740992', '4.2']) {
  test(`reject noncanonical or unsafe artifact ID ${id}`, () =>
    assert.throws(() => policy.validateArtifact(artifact(), {...expectedArtifact(), id}), /artifact outputs/));
}
for (const [name, change] of [
  ['ID', {id: 99}], ['name', {name: 'github-pages'}], ['expired', {expired: true}],
  ['digest', {digest: 'sha256:' + 'e'.repeat(64)}], ['digest absent', {digest: null}],
  ['run', {workflow_run: {id: 8, head_sha: B}}], ['workflow SHA', {workflow_run: {id: 7, head_sha: A}}],
]) test(`reject artifact ${name} mismatch`, () => assert.throws(() => policy.validateArtifact({...artifact(), ...change}, expectedArtifact()), /Release blocked/));

// Exercise the actual async gate, including settings reads, propagation and races.
function fakeGitHub({failAt, moveMain = false} = {}) {
  const s = settings(); let mainReads = 0;
  const rules = s.rules.map(rule => ({...rule, ruleset_source_type: 'Repository', ruleset_id: 10}));
  const values = new Map([
    ['/commits/' + A, {sha: A}], ['/compare/' + A + '...' + B, revision().comparison],
    ['/environments/github-pages', s.environment], ['/pages', s.pages], ['/rulesets/10', s.rulesets[0]],
    ['/environments/github-pages/deployment-branch-policies', s.branches], ['/rules/branches/main', rules],
    ['/actions/workflows', s.workflows],
  ]);
  const lookup = path => {
    const key = path.replace('GET /repos/' + policy.REPOSITORY, '');
    if (failAt === key) throw Object.assign(new Error('synthetic private error body'), {status: 403});
    if (key === '/git/ref/heads/main') return {object: {sha: moveMain && ++mainReads > 1 ? A : B}};
    assert.ok(values.has(key), 'unexpected API route: ' + key);
    return structuredClone(values.get(key));
  };
  return {request: async path => ({data: lookup(path)}), paginate: async path => lookup(path)};
}
test('async release gate accepts valid synthetic API responses and refuses API failures and main races', async () => {
  const previous = Object.fromEntries(['WORKFLOW_SHA', 'WORKFLOW_REF', 'RUN_ATTEMPT'].map(key => [key, process.env[key]]));
  process.env.WORKFLOW_SHA = B; process.env.WORKFLOW_REF = dispatch().workflowRef; process.env.RUN_ATTEMPT = '1';
  const context = {repo: {owner: 'adbrwns8-eng', repo: 'eim-v6-field-test'}, eventName: 'workflow_dispatch', ref: 'refs/heads/main', actor: dispatch().actor};
  const run = github => policy.inspectRelease({github, context, approvedSha: A, triggeringActor: dispatch().triggeringActor});
  try {
    assert.deepEqual(await run(fakeGitHub()), {approvedSha: A, workflowSha: B});
    for (const failAt of ['/git/ref/heads/main', '/commits/' + A, '/environments/github-pages', '/pages', '/rules/branches/main', '/rulesets/10', '/actions/workflows']) {
      await assert.rejects(run(fakeGitHub({failAt})), /GitHub API request failed \(HTTP 403\)/);
    }
    await assert.rejects(run(fakeGitHub({moveMain: true})), /main moved during/);
  } finally {
    for (const key of ['WORKFLOW_SHA', 'WORKFLOW_REF', 'RUN_ATTEMPT']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});

test('deployment API uses the verified artifact ID and approved SHA; failures do not mint OIDC or leak errors', async t => {
  const keys = ['WORKFLOW_SHA', 'WORKFLOW_REF', 'RUN_ATTEMPT'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.WORKFLOW_SHA = B; process.env.WORKFLOW_REF = dispatch().workflowRef; process.env.RUN_ATTEMPT = '1';
  const context = {repo: {owner: 'adbrwns8-eng', repo: 'eim-v6-field-test'}, eventName: 'workflow_dispatch',
    ref: 'refs/heads/main', actor: dispatch().actor, runId: 7};
  async function run({failAt, wrongArtifact = false, noOidc = false, postError = false, status = 'succeed', numericId = false} = {}) {
    const calls = [], outputs = [], upstream = fakeGitHub({failAt});
    const github = {...upstream, request: async (route, params) => {
      if (route === 'GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}') {
        assert.equal(params.artifact_id, '42');
        return {data: {...artifact(), ...(wrongArtifact ? {id: 99} : {})}};
      }
      if (route === 'POST /repos/{owner}/{repo}/pages/deployments') {
        calls.push('POST');
        assert.equal(params.artifact_id, 42);
        assert.equal(params.pages_build_version, A);
        assert.equal(params.oidc_token, 'synthetic-oidc-not-a-credential');
        if (postError) throw Object.assign(new Error('synthetic-oidc-not-a-credential'), {status: 403, request: params});
        return {data: {id: numericId ? 42 : 'synthetic-deployment', page_url: 'https://adbrwns8-eng.github.io/eim-v6-field-test/'}};
      }
      if (route === 'GET /repos/{owner}/{repo}/pages/deployments/{deployment_id}') {
        calls.push('POLL'); return {data: {status}};
      }
      return upstream.request(route, params);
    }};
    const core = {getIDToken: async () => {calls.push('OIDC'); if (noOidc) throw new Error('private OIDC failure'); return 'synthetic-oidc-not-a-credential';},
      setSecret: token => assert.equal(token, 'synthetic-oidc-not-a-credential'), setOutput: (...value) => outputs.push(value)};
    try {
      await policy.deployVerifiedArtifact({github, context, core, approvedSha: A, triggeringActor: dispatch().triggeringActor,
        expected: expectedArtifact(), sleep: async () => {}, pollLimit: 2});
      return {calls, outputs};
    } catch (error) { return {calls, outputs, error}; }
  }
  try {
    await t.test('exact immutable ID, not another name lookup', async () => {
      const result = await run(); assert.equal(result.error, undefined);
      assert.deepEqual(result.calls, ['OIDC', 'POST', 'POLL']);
      assert.deepEqual(result.outputs, [['page_url', 'https://adbrwns8-eng.github.io/eim-v6-field-test/']]);
      assert.equal((await run({numericId: true})).error, undefined);
    });
    await t.test('unreadable protections block before OIDC and POST', async () => {
      const result = await run({failAt: '/environments/github-pages'});
      assert.match(result.error.message, /HTTP 403/); assert.deepEqual(result.calls, []);
    });
    await t.test('substituted artifact blocks before OIDC and POST', async () => {
      const result = await run({wrongArtifact: true});
      assert.match(result.error.message, /artifact identity/); assert.deepEqual(result.calls, []);
    });
    await t.test('unavailable OIDC blocks POST', async () => {
      const result = await run({noOidc: true});
      assert.match(result.error.message, /OIDC unavailable/); assert.deepEqual(result.calls, ['OIDC']);
    });
    await t.test('deployment API errors are sanitized and not retried', async () => {
      const result = await run({postError: true});
      assert.equal(result.error.message, 'Release blocked: GitHub API request failed (HTTP 403)');
      assert.ok(!JSON.stringify(result.error).includes('synthetic-oidc'));
      assert.deepEqual(result.calls, ['OIDC', 'POST']);
    });
    await t.test('deployment failure propagates and is not retried', async () => {
      const result = await run({status: 'deployment_failed'});
      assert.match(result.error.message, /reported failure/); assert.deepEqual(result.calls, ['OIDC', 'POST', 'POLL']);
    });
    await t.test('status timeout is bounded without duplicate releases', async () => {
      const result = await run({status: 'queued'});
      assert.match(result.error.message, /timed out/); assert.deepEqual(result.calls, ['OIDC', 'POST', 'POLL', 'POLL']);
    });
  } finally {
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
});

const workflowDir = new URL('../.github/workflows/', import.meta.url);
const pages = YAML.parse(await readFile(new URL('pages.yml', workflowDir), 'utf8'), {uniqueKeys: true});
function checkWorkflow(workflow) {
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.deepEqual(workflow.permissions, {});
  assert.deepEqual(workflow.concurrency, {group: 'pages', 'cancel-in-progress': false});
  assert.deepEqual(workflow.on.workflow_dispatch.inputs, {approved_sha: {description: pages.on.workflow_dispatch.inputs.approved_sha.description, required: true, type: 'string'}});
  assert.deepEqual(Object.keys(workflow.jobs).sort(), ['deploy', 'prepare']);
  const {prepare, deploy} = workflow.jobs;
  assert.deepEqual(prepare.permissions, {contents: 'read', actions: 'read', pages: 'read'});
  assert.deepEqual(deploy.permissions, {contents: 'read', actions: 'read', pages: 'write', 'id-token': 'write'});
  assert.equal(deploy.needs, 'prepare'); assert.equal(deploy.environment.name, 'github-pages');
  for (const job of [prepare, deploy]) {
    assert.equal(job.if, "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'" + (job === deploy ? " && needs.prepare.result == 'success'" : ''));
    assert.equal(job.env.APPROVED_SHA, '${{ inputs.approved_sha }}');
    assert.equal(job.env.WORKFLOW_SHA, '${{ github.sha }}');
    assert.equal(job.env.RUN_ATTEMPT, '${{ github.run_attempt }}');
    assert.ok(job.timeout_minutes === undefined && job['timeout-minutes'] > 0);
    for (const step of job.steps) {
      assert.notEqual(step['continue-on-error'], true);
      assert.equal(step.if, undefined);
      if (step.uses) assert.match(step.uses, /^[a-z-]+\/[a-z-]+@[0-9a-f]{40}$/);
      if (step.uses?.startsWith('actions/checkout@')) assert.equal(step.with['persist-credentials'], false);
      if (step.run) assert.doesNotMatch(step.run, /\$\{\{\s*inputs\./);
    }
    const gate = job.steps.find(step => step.with?.script?.includes('inspectRelease'));
    assert.ok(gate); assert.match(gate.with.script, /await inspectRelease/);
    assert.ok(job.steps.indexOf(gate) < job.steps.findIndex(step => /stage --source|verify --sha/.test(step.run || '')));
  }
  const artifactCheckout = prepare.steps.find(step => step.with?.path === 'site-source');
  assert.equal(artifactCheckout.with.ref, '${{ inputs.approved_sha }}');
  for (const checkout of deploy.steps.filter(step => step.uses?.startsWith('actions/checkout@'))) {
    assert.equal(checkout.with.ref, '${{ github.sha }}'); assert.equal(checkout.with.path, 'control');
  }
  assert.ok(!deploy.steps.some(step => /npm |site-source/.test(step.run || '')));
  const bind = deploy.steps.findIndex(step => step.with?.script?.includes('validateArtifact'));
  const download = deploy.steps.findIndex(step => step.uses?.startsWith('actions/download-artifact@'));
  const verify = deploy.steps.findIndex(step => step.run?.includes('pages-artifact.py verify'));
  const publish = deploy.steps.findIndex(step => step.with?.script?.includes('await deployVerifiedArtifact'));
  assert.ok(bind >= 0 && bind < download && download < verify && verify < publish);
  assert.equal(deploy.steps[download].with['artifact-ids'], '${{ needs.prepare.outputs.artifact_id }}');
  assert.match(deploy.steps[publish].with.script, /id: process.env.ARTIFACT_ID/);
}
test('real YAML enforces manual-only triggers, exact source and job-scoped permissions', () => checkWorkflow(pages));
for (const [name, mutate] of [
  ['push trigger', w => w.on.push = {branches: ['main']}],
  ['PR trigger', w => w.on.pull_request = {}],
  ['global Pages permission', w => w.permissions.pages = 'write'],
  ['prepare OIDC permission', w => w.jobs.prepare.permissions['id-token'] = 'write'],
  ['missing approval environment', w => w.jobs.deploy.environment.name = 'ungated'],
  ['branch checkout', w => w.jobs.prepare.steps.find(s => s.with?.path === 'site-source').with.ref = 'main'],
  ['mutable action', w => w.jobs.deploy.steps.at(-1).uses = 'actions/github-script@v7'],
  ['continued verification failure', w => w.jobs.deploy.steps.find(s => s.run?.includes('pages-artifact.py verify'))['continue-on-error'] = true],
  ['removed postapproval gate', w => w.jobs.deploy.steps = w.jobs.deploy.steps.filter(s => !s.with?.script?.includes('inspectRelease'))],
]) test(`static policy catches ${name}`, () => {
  const altered = structuredClone(pages); mutate(altered); assert.throws(() => checkWorkflow(altered));
});
test('no alternate checked-in workflow can request deployment privileges', async () => {
  for (const name of await readdir(workflowDir)) {
    if (!/\.ya?ml$/.test(name) || name === 'pages.yml') continue;
    const source = await readFile(new URL(name, workflowDir), 'utf8');
    const workflow = YAML.parse(source, {uniqueKeys: true});
    assert.ok(!workflow.on.pull_request_target && !workflow.on.workflow_call);
    assert.deepEqual(workflow.permissions, {contents: 'read'});
    for (const job of Object.values(workflow.jobs)) {
      assert.ok(!job.environment && !job.permissions && !job.uses);
      for (const step of job.steps) assert.ok(!step.uses?.includes('deploy-pages') && !step.uses?.includes('configure-pages'));
    }
  }
  const owners = await readFile(new URL('../.github/CODEOWNERS', import.meta.url), 'utf8');
  assert.match(owners, /^\/\.github\/ @adbrwns8-eng$/m); assert.match(owners, /^\/scripts\/ @adbrwns8-eng$/m);
});
