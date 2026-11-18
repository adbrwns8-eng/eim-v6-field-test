import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(
  new URL('../.github/workflows/pages.yml', import.meta.url),
  'utf8',
);

assert.doesNotMatch(
  workflow,
  /^\s{2}push:/m,
  'Pages deployment must not run automatically on push',
);
assert.match(workflow, /^\s{2}workflow_dispatch:/m);
assert.match(workflow, /release_sha:/);
assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
assert.match(workflow, /git merge-base --is-ancestor "\$RELEASE_SHA" origin\/main/);
assert.match(workflow, /ref: \$\{\{ needs\.validate-release\.outputs\.release_sha \}\}/);
assert.match(workflow, /persist-credentials: false/);

const beforeDeploy = workflow.slice(0, workflow.indexOf('\n  deploy:'));
assert.doesNotMatch(beforeDeploy, /pages: write/);
assert.doesNotMatch(beforeDeploy, /id-token: write/);

console.log('Deployment workflow checks passed: manual dispatch, approved main SHA, and scoped write permissions.');
