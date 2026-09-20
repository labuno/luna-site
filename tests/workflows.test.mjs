import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';

const workflowPath = (name) => new URL(`../.github/workflows/${name}`, import.meta.url);

async function readWorkflow(name) {
  return parseYaml(await readFile(workflowPath(name), 'utf8'));
}

function allSteps(workflow) {
  return Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

function stepText(steps) {
  return steps
    .map(
      (step) =>
        `${step.name ?? ''} ${step.uses ?? ''} ${step.run ?? ''} ${JSON.stringify(step.with ?? {})} ${JSON.stringify(step.env ?? {})}`,
    )
    .join('\n');
}

test('ci.yml 不依赖私有 Token，使用 Demo 内容构建', async () => {
  const workflow = await readWorkflow('ci.yml');
  const text = JSON.stringify(workflow);
  assert.ok('pull_request' in workflow.on, 'CI 必须响应 pull_request');
  assert.ok('push' in workflow.on, 'CI 必须响应 push');
  assert.ok(!text.includes('secrets.'), '公开仓库 CI 不能引用任何 secret');
  const body = stepText(allSteps(workflow));
  assert.match(body, /npm ci/);
  assert.match(body, /npm run test/);
  assert.match(body, /npm run build:demo/);
});

test('deploy-pages.yml 满足文档 7.1-7.4 的约束', async () => {
  const workflow = await readWorkflow('deploy-pages.yml');
  const steps = allSteps(workflow);
  const body = stepText(steps);

  assert.ok(workflow.on.workflow_dispatch?.inputs?.content_ref, '必须支持 content_ref 输入');
  assert.equal(workflow.concurrency?.group, 'lunafoundry-pages');
  assert.equal(workflow.concurrency?.['cancel-in-progress'], true);

  const checkoutContent = steps.find((step) => step.with?.path === '.content-source');
  assert.ok(checkoutContent, '必须把私有内容 checkout 到 .content-source');
  assert.equal(checkoutContent.with.repository, '${{ env.CONTENT_REPOSITORY }}');
  assert.match(
    JSON.stringify(workflow),
    /vars\.CONTENT_REPOSITORY \|\| 'lunafoundry\/content'/,
    '内容仓库默认值必须是 lunafoundry/content',
  );
  assert.equal(checkoutContent.with['persist-credentials'], false);
  assert.match(String(checkoutContent.with.token), /secrets\.CONTENT_REPO_TOKEN/);
  assert.match(String(checkoutContent.with.ref), /CONTENT_REF|content_ref|inputs\.content_ref/);

  const setupNode = steps.find((step) => String(step.uses ?? '').startsWith('actions/setup-node'));
  assert.equal(setupNode.with['node-version'], '24', 'CI 固定 Node 24');
  assert.equal(setupNode.with.cache, 'npm');

  const runs = steps.map((step) => step.run ?? '').join('\n');
  assert.match(runs, /npm ci/, '生产构建使用 npm ci');
  assert.match(runs, /content:sync -- \.content-source/, '同步私有内容');
  assert.match(runs, /npm run build\b/);
  assert.match(runs, /check:dist/);

  assert.equal(workflow.jobs.deploy.permissions.pages, 'write');
  assert.equal(workflow.jobs.deploy.permissions['id-token'], 'write');
  assert.equal(workflow.jobs.deploy.environment.name, 'github-pages');
  assert.equal(workflow.jobs.deploy.needs, 'build');
});

test('notify-site.yml 触发站点构建并绑定 content SHA', async () => {
  const workflow = parseYaml(
    await readFile(new URL('../../content/.github/workflows/notify-site.yml', import.meta.url), 'utf8'),
  );
  const body = stepText(allSteps(workflow));
  assert.match(body, /secrets\.SITE_WORKFLOW_TOKEN/);
  assert.match(body, /gh workflow run deploy-pages\.yml/);
  assert.match(body, /content_ref="\$GITHUB_SHA"/);
  assert.equal(workflow.env.SITE_REPOSITORY, "${{ vars.SITE_REPOSITORY || 'lunafoundry/luna-site' }}");
  assert.equal(workflow.permissions?.contents, 'read');
});
