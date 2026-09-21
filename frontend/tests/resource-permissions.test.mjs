import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/resource-permissions.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { canCreateResource, canManageResource, canDeleteResource, canTestNode, canViewResourceDetails } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('node details require an administrator while members retain subscription node tests', () => {
  assert.equal(canViewResourceDetails('admin', 'nodes'), true);
  for (const role of ['user', 'guest', undefined]) assert.equal(canViewResourceDetails(role, 'nodes'), false);
  assert.equal(canViewResourceDetails('user', 'subscriptions'), true);
  assert.equal(canTestNode('user', { id: 'subscribed', subscriptionAuthorized: true, canTest: true }), true);
});

test('UDP protocols do not offer TCP connection tests', () => {
  for (const protocol of ['Hysteria','Hysteria2','TUIC','WireGuard']) {
    assert.equal(canTestNode('admin',{id:'udp',protocol}),false);
    assert.equal(canTestNode('user',{id:'udp',protocol,canTest:true,subscriptionAuthorized:true}),false);
  }
});

test('members cannot manage nodes even with a legacy ownership permission', () => {
  assert.equal(canCreateResource('user', 'nodes'), false);
  assert.equal(canCreateResource('user', 'sources'), false);
  assert.equal(canCreateResource('user', 'servers'), false);
  assert.equal(canCreateResource(undefined, 'nodes'), false);
  assert.equal(canManageResource('user', 'nodes', { id: 'plan-node', name: 'member' }), false);
  assert.equal(canManageResource('user', 'nodes', { id: 'own', canManage: true }), false);
  assert.equal(canManageResource('user', 'nodes', { id: 'plan-node', canManage: false }), false);
  assert.equal(canManageResource('user', 'nodes', { id: 'untrusted', canManage: 'true' }), false);
  assert.equal(canManageResource('admin', 'servers', { id: 'server' }), true);
  assert.equal(canManageResource('admin', 'audit', { id: 'event' }, true), false);
});

test('members can test only explicitly authorized subscription nodes without editing them', () => {
  const subscribed = { id: 'subscribed', subscriptionAuthorized: true, canTest: true };
  assert.equal(canTestNode('user', subscribed), true);
  assert.equal(canManageResource('user', 'nodes', subscribed), false);
  assert.equal(canDeleteResource('user', 'nodes', subscribed), false);
  for (const row of [{ id: 'own', canManage: true }, { id: 'unassigned', canTest: true }, { ...subscribed, subscriptionAuthorized: 'true' }, { ...subscribed, canTest: false }]) {
    assert.equal(canTestNode('user', row), false);
  }
  for (const role of [undefined, 'guest']) assert.equal(canTestNode(role, subscribed), false);
  assert.equal(canTestNode('admin', { id: 'any' }), true);
});

test('only administrators can create, edit, act on or delete external sources', () => {
  for (const role of ['user', undefined, 'guest']) {
    assert.equal(canCreateResource(role, 'sources'), false);
    assert.equal(canManageResource(role, 'sources', {id:'own-source', canManage:true}), false);
    assert.equal(canDeleteResource(role, 'sources', {id:'own-source', canManage:true}), false);
  }
  assert.equal(canCreateResource('admin', 'sources'), true);
  assert.equal(canManageResource('admin', 'sources', {id:'source'}), true);
  assert.equal(canDeleteResource('admin', 'sources', {id:'source'}), true);
});

test('only administrators can delete finished task and audit logs without edit permissions', () => {
  for (const status of ['success', 'failed', 'unsupported', 'superseded', '成功', '失败', '不支持', '已撤回']) {
    const row = { id: 'task', status };
    assert.equal(canDeleteResource('admin', 'tasks', row, true), true);
    assert.equal(canManageResource('admin', 'tasks', row, true), false);
    assert.equal(canCreateResource('admin', 'tasks', true), false);
    for (const role of ['user', undefined]) assert.equal(canDeleteResource(role, 'tasks', row, true), false);
  }
  assert.equal(canDeleteResource('admin', 'audit', { id: 'event' }, true), true);
  assert.equal(canDeleteResource('user', 'audit', { id: 'event' }, true), false);
  assert.equal(canDeleteResource(undefined, 'audit', { id: 'event' }, true), false);
});

test('unfinished, uncertain and protected tasks cannot be deleted', () => {
  for (const status of ['queued', 'running', 'unknown', '待下发', '待处理', '执行中', '结果未明', '', undefined]) {
    assert.equal(canDeleteResource('admin', 'tasks', { id: 'task', status }, true), false);
  }
  assert.equal(canDeleteResource('admin', 'tasks', { id: 'task', status: '成功', canDelete: false }, true), false);
  assert.equal(canDeleteResource('user', 'nodes', { id: 'shared', canManage: false }), false);
  assert.equal(canDeleteResource('user', 'nodes', { id: 'own', canManage: true }), false);
  assert.equal(canDeleteResource('admin', 'servers', { id: 'server' }), true);
  assert.equal(canDeleteResource('admin', 'billing', { id: 'bill' }, true), false);
});
