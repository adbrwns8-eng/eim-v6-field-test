// Offline diagnostic, not an acceptance test or a deployment client.
// Execute the exact reviewed function in a sandbox with fake gates, API and OIDC.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const evidence = JSON.parse(readFileSync(new URL('../docs/security/005a-r1-contract-evidence.json', import.meta.url)));
const sha = evidence.candidate_sha;
assert.equal(execFileSync('git', ['rev-parse', '--verify', sha + '^{commit}'], {encoding: 'utf8'}).trim(), sha);
const source = execFileSync('git', ['show', sha + ':scripts/release-policy.cjs'], {encoding: 'utf8'});
const start = source.indexOf('async function deployVerifiedArtifact(');
const end = source.indexOf('\nmodule.exports =', start);
assert.ok(start >= 0 && end > start, 'Reviewed function boundaries changed; stop');
const captured = [];
const sandbox = {
  process: {env: {WORKFLOW_SHA: 'b'.repeat(40)}},
  inspectRelease: async () => {}, // Deliberately isolate payload contract, NOT gate correctness.
  validateArtifact: () => {},
  safeApi: async callback => callback(),
  requireSafe: (condition, message) => assert.ok(condition, message),
};
const deploy = vm.runInNewContext('(' + source.slice(start, end) + ')', sandbox, {timeout: 1000});
const github = {request: async (route, body) => {
  if (route === 'GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}') return {data: {}};
  if (route === 'POST /repos/{owner}/{repo}/pages/deployments') {
    captured.push({artifact_id: body.artifact_id, pages_build_version: body.pages_build_version});
    return {data: {id: 42, page_url: 'https://adbrwns8-eng.github.io/eim-v6-field-test/'}};
  }
  if (route === 'GET /repos/{owner}/{repo}/pages/deployments/{deployment_id}') return {data: {status: 'succeed'}};
  throw new Error('Unexpected stub route; no network is available');
}};
await deploy({github, context: {repo: {owner: 'synthetic', repo: 'synthetic'}, runId: 7},
  core: {getIDToken: async () => 'synthetic-not-a-credential', setSecret: () => {}, setOutput: () => {}},
  approvedSha: 'a'.repeat(40), triggeringActor: 'synthetic', expected: {id: '42', digest: 'd'.repeat(64), name: 'synthetic'},
  sleep: async () => {}, pollLimit: 1});
assert.equal(captured.length, 1);
assert.equal(evidence.create_pages_deployment.artifact_id.type, 'number');
assert.equal(typeof captured[0].artifact_id, 'string');
assert.notEqual(typeof captured[0].artifact_id, evidence.create_pages_deployment.artifact_id.type);
console.log('CONFIRMED SCHEMA MISMATCH: reviewed candidate sends artifact_id as string; official schema requires number.');
console.log('Expected-negative reproduction succeeded; no real API request or OIDC token was used.');

// Proposed normalization model only. This does NOT patch PR #7 or prove API acceptance.
function proposedNumericId(value) {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error('invalid ID');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || String(number) !== value) throw new Error('inexact ID');
  return number;
}
assert.equal(proposedNumericId('42'), 42);
for (const invalid of ['', '0', '-1', '1.5', '042', '42\n', '9007199254740993']) assert.throws(() => proposedNumericId(invalid));
console.log('Proposed safe-integer normalization model: 1 positive and 7 negative cases passed.');
