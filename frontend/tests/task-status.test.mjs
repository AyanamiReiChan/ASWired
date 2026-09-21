import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/task-status.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { taskStatus } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const task = { id: 'task', target: 'new-server', status: '待下发' };
const servers = [
  { id: 'new-server', name: '1', address: '1', status: '待接入' },
  { id: 'actual-agent', name: 'Online Agent', address: '192.0.2.171', status: '在线' }
];

test('pending work explains the target connection rather than another online Agent', () => {
  const view = taskStatus(task, servers);
  assert.equal(view.targetName, '1');
  assert.equal(view.address, '1');
  assert.match(view.message, /等待「1」的 Agent 连接/);
  assert.doesNotMatch(view.message, /从未|未安装/);
  assert.equal(view.canRetry, false);
  assert.equal(view.serverURL, '/servers?detail=new-server');
});

test('connection recovery and execution change the explanation without changing task state', () => {
  const connected = servers.map(row => ({ ...row, status: '在线' }));
  assert.match(taskStatus(task, connected).message, /领取任务/);
  const running = taskStatus({ ...task, status: '执行中' }, connected);
  assert.equal(running.canRetry, false);
  assert.match(running.message, /等待目标 Agent 返回/);
  assert.equal(task.status, '待下发');
});

test('unavailable targets do not leak or invent server identities', () => {
  const view = taskStatus(task, []);
  assert.equal(view.targetName, 'new-server');
  assert.equal(view.serverURL, '');
  assert.match(view.message, /核对目标身份/);
  assert.equal(taskStatus(task, [{ ...servers[0], status: '停用' }]).message.includes('目标已停用'), true);
});

test('retired tasks explain why they will not run and cannot be retried', () => {
  for (const status of ['superseded', 'cancelled', '已撤回']) {
    const view = taskStatus({ ...task, status, error: '无需下发空策略，任务未执行' }, servers);
    assert.equal(view.canRetry, false);
    assert.equal(view.message, '无需下发空策略，任务未执行');
  }
  assert.equal(taskStatus({ ...task, status: '失败' }, servers).canRetry, true);
});
