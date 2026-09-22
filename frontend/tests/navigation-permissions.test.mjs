import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/lib/navigation.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { groups, navigation, canAccessPage } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('subscription and user pages are consolidated into workspace without duplicate routes',()=>{
 assert.deepEqual(groups.map(group=>group.name),['工作区','运维']);
 const paths=groups.find(group=>group.name==='工作区').items.map(([path])=>path);
 for(const path of ['/nodes','/sources','/subscriptions','/temporary-subscriptions','/templates','/plans','/members','/portal','/account'])assert(paths.includes(path),path);
 assert.equal(new Set(navigation.map(([path])=>path)).size,navigation.length);
 assert.equal(canAccessPage('user','/members'),false);
 assert.equal(canAccessPage('user','/account'),true);
});

test('navigation and direct access exclude the removed design page',()=>{
 for(const route of ['/inbounds','/outbounds','/routing'])assert.equal(navigation.some(([path])=>path===route),false);
 assert.equal(navigation.some(([path])=>path==='/design'),false);
 for(const role of ['admin','user',undefined])assert.equal(canAccessPage(role,'/design'),false);
});

test('the full operations group is restricted to administrators for navigation and direct routes', () => {
  const operations = groups.find(group => group.name === '运维');
  assert.ok(operations.items.length >= 7);
  for (const [path] of operations.items) {
    assert.equal(canAccessPage('admin', path), true, path);
    for (const role of ['user', undefined, 'guest']) assert.equal(canAccessPage(role, path), false, `${role}: ${path}`);
  }
  const memberGroups = groups.filter(group => group.items.some(([path]) => canAccessPage('user', path)));
  assert.equal(memberGroups.some(group => group.name === '运维'), false);
  const searchable = navigation.filter(([path]) => canAccessPage('user', path));
  assert.equal(searchable.some(([path]) => operations.items.some(([restricted]) => restricted === path)), false);
});

test('members retain subscriptions, personal resources and account pages', () => {
  for (const path of ['/', '/portal', '/subscriptions', '/nodes', '/temporary-subscriptions', '/probe', '/account', '/join']) {
    assert.equal(canAccessPage('user', path), true, path);
  }
  for (const path of ['/servers', '/settings', '/komari', '/tasks/', '/tasks/detail', '/limits/', '/unknown']) assert.equal(canAccessPage('user', path), false, path);
});

test('removed REALITY pool is absent from navigation and search and remains restricted', () => {
  const path = '/reality-targets';
  assert.equal(canAccessPage('admin', path), true);
  assert.equal(navigation.some(([url]) => url === path), false);
  for (const role of ['user', undefined, 'guest']) {
    for (const url of [path, path + '/', path + '/scan']) assert.equal(canAccessPage(role, url), false);
    const items = groups.flatMap(group => group.items.filter(([url]) => canAccessPage(role, url)));
    assert.equal(items.some(([url]) => url === path), false);
    assert.equal(navigation.filter(([url]) => canAccessPage(role, url)).some(([url]) => url === path), false);
  }
});

test('external sources are only available to administrators in navigation and direct routes', () => {
  assert.equal(canAccessPage('admin', '/sources'), true);
  for (const role of ['user', undefined, 'guest']) {
    for (const path of ['/sources', '/sources/', '/sources/detail']) assert.equal(canAccessPage(role, path), false);
    assert.equal(navigation.filter(([path]) => canAccessPage(role, path)).some(([path]) => path === '/sources'), false);
  }
});
