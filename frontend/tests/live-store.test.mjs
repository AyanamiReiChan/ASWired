import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { compileModule } from 'svelte/compiler';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../src/lib/store.svelte.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const loginSource = fs.readFileSync(new URL('../src/lib/unified-login.ts', import.meta.url), 'utf8');
const loginJS = ts.transpileModule(loginSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const loginURL = 'data:text/javascript;base64,' + Buffer.from(loginJS).toString('base64');
const compiled = compileModule(js, { filename: 'store.svelte.js', generate: 'client' }).js.code
  .replace(/(['"])svelte\/internal\/client\1/g, JSON.stringify(pathToFileURL(require.resolve('svelte/internal/client')).href))
  .replace(/(['"])\.\/unified-login\1/g, JSON.stringify(loginURL));
let serial = 0;
const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const account = { id: 'user-1', username: 'test-admin', role: 'admin' };
const state = (data = {}, user = account) => ({ data, user, settings: { workspace: 'ASWired' }, capabilities: {} });
function deferred() { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; }
const minuteTraffic = (id, total = 1, to = Date.parse('2026-09-17T12:34:56Z')) => ({ interval: '1m', bucketSeconds: 60, from: to - 86400000, to, series: id ? [{ id, at: Math.floor(to / 60000) * 60000, total }] : [], incomplete: false });
async function fresh(t, handler, trafficHandler = () => Promise.resolve(respond({ series: [], servers: [], members: [], incomplete: true })), minuteHandler = () => Promise.resolve(respond(minuteTraffic('')))) {
  const storage = new Map();
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.sessionStorage;
  globalThis.fetch = (path,init) => path === '/api/traffic?range=24h&interval=1m' ? minuteHandler(path,init) : path.startsWith('/api/traffic?') ? trafficHandler(path,init) : handler(path,init);
  globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const store = await import('data:text/javascript;base64,' + Buffer.from(compiled + `\n// instance ${++serial}`).toString('base64'));
  t.after(() => { store.stopRefresh(); globalThis.fetch = originalFetch; if (originalStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = originalStorage; });
  return { store, storage };
}

test('first launch stays empty and never seeds demonstration rows', async t => {
  const { store } = await fresh(t, async path => { assert.equal(path, '/api/status'); return respond({ initialized: false, version: 'test', capabilities: {} }); });
  await store.initialize();
  assert.equal(store.demo.initialized, false);
  assert.equal(store.demo.user, null);
  assert.equal(Object.values(store.demo.data).flat().length, 0);
});

test('silent entry startup sends an existing JWT with the first status request', async t => {
  const calls = [];
  const { store, storage } = await fresh(t, async (path, init) => {
    calls.push(path);
    assert.equal(init.headers.get('MM-Authorization'), 'existing.jwt');
    return respond(path === '/api/status' ? { initialized: true, version: 'test' } : state());
  });
  storage.set('aswired-session', 'existing.jwt');
  await store.initialize();
  assert.equal(calls[0], '/api/status');
  assert.equal(store.demo.hiddenEntry, false);
  assert.equal(store.demo.user.id, account.id);
});

test('a concealed status response leaves no login identity or private state', async t => {
  const { store, storage } = await fresh(t, async () => respond({ error: { message: 'Not Found' } }, 404));
  storage.set('aswired-session', 'obsolete.jwt');
  await store.initialize();
  assert.equal(store.demo.connecting, false);
  assert.equal(store.demo.hiddenEntry, true);
  assert.equal(store.demo.user, null);
  assert.equal(store.demo.connectionError, '');
  assert.equal(Object.values(store.demo.data).flat().length, 0);
  assert.equal(storage.size, 0);
});

test('login sends JWT in MM-Authorization and uses server-owned role', async t => {
  const calls = [];
  const { store } = await fresh(t, async (path, init) => {
    calls.push({ path, init });
    if (path === '/api/login') return respond({ token: 'test.jwt', user: account });
    assert.equal(init.headers.get('MM-Authorization'), 'test.jwt');
    return respond(state());
  });
  await store.authenticate('test-admin', 'test-only-password');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { username: 'test-admin', password: 'test-only-password' });
  assert.equal(store.demo.user.id, account.id);
  assert.equal(store.demo.role, '管理员');
});

test('members keep their own subscription usage without requesting or caching operations data', async t => {
  const member = { id: 'member-1', username: 'member', role: 'user' };
  const subscription = { id: 'subscription-1', used: 2.5, limit: 100 };
  let trafficRequests = 0;
  const deniedCollections = ['sources', 'tasks', 'audit', 'certificates', 'notifications', 'extensions', 'traffic', 'trafficServers', 'trafficMembers', 'trafficMinutes'];
  const payload = Object.fromEntries(deniedCollections.map(collection => [collection, [{ id: 'private' }]]));
  const { store } = await fresh(t, async () => respond(state({ ...payload, subscriptions: [subscription], members: [{ ...member, used: 2.5 }] }, member)), async () => { trafficRequests++; return respond({}); }, async () => { trafficRequests++; return respond({}); });
  await store.acceptSession({ token: 'member.jwt', user: member });
  await store.refreshState();
  assert.equal(trafficRequests, 0);
  for (const collection of deniedCollections) assert.deepEqual(store.demo.data[collection], [], collection);
  assert.deepEqual(store.demo.data.subscriptions, [subscription]);
  assert.equal(store.demo.data.members[0].used, 2.5);
  assert.equal(store.demo.trafficError, '');
  assert.equal(store.demo.minuteTrafficError, '');
});

test('downgrading an administrator clears operational state and stops traffic polling', async t => {
  let role = 'admin', trafficRequests = 0;
  const { store } = await fresh(t, async () => respond(state({ sources: [{ id: 'private-source' }], tasks: [{ id: 'private' }], subscriptions: [{ id: 'own', used: 3 }] }, { ...account, role })), async () => { trafficRequests++; return respond(traffic('admin')); }, async () => { trafficRequests++; return respond(minuteTraffic('admin')); });
  await store.acceptSession({ token: 'same.jwt', user: account });
  assert.equal(trafficRequests, 2);
  assert.equal(store.demo.data.tasks.length, 1);
  assert.equal(store.demo.data.sources.length, 1);
  role = 'user'; await store.refreshState();
  assert.equal(trafficRequests, 2);
  for (const collection of ['sources', 'tasks', 'traffic', 'trafficServers', 'trafficMembers', 'trafficMinutes']) assert.deepEqual(store.demo.data[collection], []);
  assert.equal(store.demo.data.subscriptions[0].used, 3);
  assert.equal(store.demo.trafficLoaded, false);
  assert.equal(store.demo.minuteTrafficLoaded, false);
});

test('member state drops legacy own nodes and removes subscription nodes after access is revoked', async t => {
  const member = { id: 'member-1', username: 'member', role: 'user' };
  const subscribed = { id: 'subscribed', subscriptionAuthorized: true, canTest: true, canManage: false };
  let nodes = [subscribed, { id: 'legacy-own', canManage: true }, { id: 'unassigned', canTest: true }, { id: 'invalid-flag', subscriptionAuthorized: 'true' }];
  const { store } = await fresh(t, async () => respond(state({ nodes }, member)));
  await store.acceptSession({ token: 'member.jwt', user: member });
  assert.deepEqual(store.demo.data.nodes, [subscribed]);
  nodes = [];
  await store.refreshState();
  assert.deepEqual(store.demo.data.nodes, []);
});

test('downgrading an administrator discards nodes outside their subscription scope', async t => {
  let role = 'admin';
  const subscribed = { id: 'subscribed', subscriptionAuthorized: true };
  const nodes = [subscribed, { id: 'other', canManage: true }];
  const { store } = await fresh(t, async () => respond(state({ nodes }, { ...account, role })));
  await store.acceptSession({ token: 'same.jwt', user: account });
  assert.deepEqual(store.demo.data.nodes, nodes);
  role = 'user';
  await store.refreshState();
  assert.deepEqual(store.demo.data.nodes, [subscribed]);
});

test('save waits for success and reloads redacted state rather than credential response', async t => {
  const mutation = deferred(); let saved = false;
  const { store } = await fresh(t, async (path, init) => {
    if (path === '/api/login') return respond({ token: 'test.jwt', user: account });
    if (path === '/api/state') return respond(state({ inbounds: saved ? [{ id: 'in-1', name: 'Reality', publicKey: 'public' }] : [] }));
    assert.equal(path, '/api/collections/inbounds'); assert.equal(init.method, 'POST');
    await mutation.promise; saved = true; return respond({ row: { id: 'in-1', name: 'Reality', privateKey: 'private-fixture', publicKey: 'public' } });
  });
  await store.authenticate('test-admin', 'test-only-password');
  const saving = store.saveRow('inbounds', { id: 'in-1', name: 'Reality' });
  assert.equal(store.demo.data.inbounds.length, 0);
  mutation.resolve(); await saving;
  assert.equal(store.demo.data.inbounds.length, 1);
  assert.equal(store.demo.data.inbounds[0].privateKey, undefined);
});

test('rejected deletion and unsupported action never fabricate success or tasks', async t => {
  const { store } = await fresh(t, async path => {
    if (path === '/api/login') return respond({ token: 'test.jwt', user: account });
    if (path === '/api/state') return respond(state({ servers: [{ id: 'srv-1', name: 'Existing' }], tasks: [] }));
    return respond({ error: { code: 'unsupported', message: '该能力尚未接通' } }, 501);
  });
  await store.authenticate('test-admin', 'test-only-password');
  await assert.rejects(store.removeRow('servers', 'srv-1'), /该能力尚未接通/);
  await assert.rejects(store.runAction('unimplemented', 'srv-1', 'servers'), /该能力尚未接通/);
  assert.equal(store.demo.data.servers.length, 1);
  assert.equal(store.demo.data.tasks.length, 0);
});

test('expired login clears all private state and stored credentials', async t => {
  let expired = false;
  const { store, storage } = await fresh(t, async path => {
    if (path === '/api/login') return respond({ token: 'test.jwt', user: account });
    return expired ? respond({ error: { message: 'expired' } }, 401) : respond(state({ servers: [{ id: 'srv-1', name: 'Private host' }] }));
  });
  await store.authenticate('test-admin', 'test-only-password'); expired = true;
  await assert.rejects(store.refreshState(), /expired/);
  assert.equal(store.demo.user, null);
  assert.equal(store.demo.data.servers.length, 0);
  assert.equal(Object.keys(store.demo.settings).length, 0);
  assert.equal(storage.size, 0);
});

test('in-flight state cannot repopulate the workspace after logout', async t => {
  const refresh = deferred(); let delay = false;
  const { store } = await fresh(t, async path => {
    if (path === '/api/login') return respond({ token: 'test.jwt', user: account });
    if (path === '/api/logout') return respond({ success: true });
    if (path === '/api/status') return respond({ initialized: true, version: 'test' });
    if (delay) await refresh.promise;
    return respond(state({ servers: [{ id: 'srv-1', name: 'Private host' }] }));
  });
  await store.authenticate('test-admin', 'test-only-password'); delay = true;
  const request = store.refreshState();
  await store.logout(); refresh.resolve(); await request;
  assert.equal(store.demo.user, null);
  assert.equal(store.demo.data.servers.length, 0);
});

for (const fails of [false, true]) {
  test(`post-deletion refresh waits for an older ${fails ? 'failed' : 'successful'} poll and then fetches fresh records`, async t => {
    const delayed = deferred(); let reads = 0;
    const { store } = await fresh(t, async path => {
      if (path === '/api/login') return respond({ token: 'test.jwt', user: account });
      reads++;
      if (reads === 2) {
        await delayed.promise;
        return fails ? respond({ error: { message: 'old poll failed' } }, 503) : respond(state({ tasks: [{ id: 'deleted-task' }] }));
      }
      return respond(state({ tasks: reads === 1 ? [{ id: 'deleted-task' }] : [] }));
    });
    await store.authenticate('test-admin', 'test-only-password');
    const old = store.refreshState().catch(() => {});
    const freshOne = store.refreshState(true);
    const freshTwo = store.refreshState(true);
    assert.equal(reads, 2);
    delayed.resolve(); await Promise.all([old, freshOne, freshTwo]);
    assert.equal(reads, 3);
    assert.deepEqual(store.demo.data.tasks, []);
  });
}

test('a queued post-deletion refresh does not cross into a new login session', async t => {
  const delayed = deferred(); let reads = 0;
  const other = { id: 'user-2', username: 'second', role: 'user' };
  const { store } = await fresh(t, async (path, init) => {
    reads++;
    if (reads === 2) { await delayed.promise; return respond(state({ tasks: [{ id: 'old-task' }] })); }
    return respond(state({}, init.headers.get('MM-Authorization') === 'second.jwt' ? other : account));
  });
  await store.acceptSession({ token: 'first.jwt', user: account });
  const old = store.refreshState();
  const queued = store.refreshState(true);
  await store.acceptSession({ token: 'second.jwt', user: other });
  delayed.resolve(); await Promise.all([old, queued]);
  assert.equal(reads, 3);
  assert.equal(store.demo.user.id, other.id);
  assert.deepEqual(store.demo.data.tasks, []);
});

test('logout rechecks concealed entry before showing an anonymous login page', async t => {
  const { store } = await fresh(t, async path => {
    if (path === '/api/login') return respond({ token: 'test.jwt', user: account });
    if (path === '/api/logout') return respond({ success: true });
    if (path === '/api/status') return respond({ error: { message: 'Not Found' } }, 404);
    return respond(state());
  });
  await store.authenticate('test-admin', 'test-only-password');
  await store.logout();
  assert.equal(store.demo.user, null);
  assert.equal(store.demo.hiddenEntry, true);
});

test('an old concealed status response cannot erase a newly accepted session', async t => {
  const stale = deferred();
  const { store } = await fresh(t, async path => {
    if (path === '/api/status') { await stale.promise; return respond({ error: { message: 'Not Found' } }, 404); }
    return respond(state());
  });
  const initializing=store.initialize();
  await store.acceptSession({ token:'new.jwt',user:account });
  stale.resolve();await initializing;
  assert.equal(store.demo.user.id,account.id);
  assert.equal(store.demo.hiddenEntry,false);
  assert.equal(store.demo.connecting,false);
});

test('an expired response from a previous session does not revoke a newer login', async t => {
  const old = deferred(); let token = 'old.jwt';
  const { store } = await fresh(t, async path => {
    if (path === '/api/login') return respond({ token, user: account });
    if (path === '/api/old-operation') { await old.promise; return respond({ error: { message: 'old expired' } }, 401); }
    return respond(state());
  });
  await store.authenticate('test-admin', 'test-only-password');
  const obsolete = store.api('/api/old-operation');
  token = 'new.jwt'; await store.authenticate('test-admin', 'test-only-password');
  old.resolve(); await assert.rejects(obsolete, /old expired/);
  assert.equal(store.demo.user.id, account.id);
});

test('a rejected second factor does not discard an otherwise valid JWT', async t => {
  const { store } = await fresh(t, async path => {
    if (path === '/api/login') return respond({ token: 'test.jwt', user: account });
    if (path === '/api/state') return respond(state());
    return respond({ error: { code: 'invalid_totp', message: '验证码无效' } }, 401);
  });
  await store.authenticate('test-admin', 'test-only-password');
  await assert.rejects(store.api('/api/account/password', { method: 'POST', body: '{}' }), /验证码无效/);
  assert.equal(store.demo.user.id, account.id);
});

const traffic = (id, total = 1) => ({
  series: [{ id: '2026-09-16', date: '2026-09-16', total }],
  servers: [{ id: `server-${id}`, name: id, used: total }],
  members: [{ id: `member-${id}`, name: id, used: total }],
  incomplete: false,
});
function assertTraffic(store, expected) {
  assert.deepEqual(store.demo.data.traffic, expected.series);
  assert.deepEqual(store.demo.data.trafficServers, expected.servers);
  assert.deepEqual(store.demo.data.trafficMembers, expected.members);
}

test('a state refresh keeps all previous traffic until its delayed traffic request finishes', async t => {
  const started = deferred();
  const release = deferred();
  const previous = traffic('previous');
  const next = traffic('next', 2);
  let trafficRequests = 0;
  let revision = 0;
  const { store } = await fresh(t, async path => {
    assert.equal(path, '/api/state');
    return respond(state({ servers: [{ id: 'srv-1', name: `Revision ${++revision}` }] }));
  }, async () => {
    if (++trafficRequests === 1) return respond(previous);
    started.resolve();
    await release.promise;
    return respond(next);
  });
  await store.acceptSession({ token: 'test.jwt', user: account });
  const refreshing = store.refreshState();
  try {
    await started.promise;
    assert.equal(store.demo.data.servers[0].name, 'Revision 2');
    assertTraffic(store, previous);
    assert.equal(store.demo.trafficLoaded, true);
  } finally {
    release.resolve();
    await refreshing;
  }
  assertTraffic(store, next);
  assert.equal(store.demo.trafficError, '');
});

for (const failure of ['network', 'server']) {
  test(`a temporary traffic ${failure} failure retains the previous result and later accepts a real empty result`, async t => {
    const previous = traffic('previous');
    const recovered = traffic('recovered', 3);
    const empty = { series: [], servers: [], members: [], incomplete: true };
    let phase = 'initial';
    const { store } = await fresh(t, async path => {
      assert.equal(path, '/api/state');
      return respond(state());
    }, async () => {
      if (phase === 'failed') {
        if (failure === 'network') throw new TypeError('network unavailable');
        return respond({ error: { message: 'temporary traffic failure' } }, 500);
      }
      return respond(phase === 'empty' ? empty : phase === 'recovered' ? recovered : previous);
    });
    await store.acceptSession({ token: 'test.jwt', user: account });
    phase = 'failed';
    await store.refreshState();
    assertTraffic(store, previous);
    assert.equal(store.demo.trafficLoaded, true);
    assert.match(store.demo.trafficError, failure === 'network' ? /无法连接主控/ : /temporary traffic failure/);
    phase = 'recovered';
    await store.refreshState();
    assertTraffic(store, recovered);
    assert.equal(store.demo.trafficError, '');
    assert.equal(store.demo.trafficLoaded, true);
    phase = 'empty';
    await store.refreshState();
    assertTraffic(store, empty);
    assert.equal(store.demo.trafficError, '');
    assert.equal(store.demo.trafficLoaded, true);
  });
}

test('accepting another account removes the previous traffic before the new traffic arrives', async t => {
  const nextAccount = { id: 'user-2', username: 'next-user', role: 'admin' };
  const previous = traffic('previous-private');
  const next = traffic('next-private', 4);
  const started = deferred();
  const release = deferred();
  const { store } = await fresh(t, async (path, init) => {
    assert.equal(path, '/api/state');
    return respond(state({}, init.headers.get('MM-Authorization') === 'next.jwt' ? nextAccount : account));
  }, async (path, init) => {
    if (init.headers.get('MM-Authorization') === 'old.jwt') return respond(previous);
    started.resolve();
    await release.promise;
    return respond(next);
  });
  await store.acceptSession({ token: 'old.jwt', user: account });
  assertTraffic(store, previous);
  const switching = store.acceptSession({ token: 'next.jwt', user: nextAccount });
  try {
    assertTraffic(store, { series: [], servers: [], members: [] });
    assert.equal(store.demo.trafficLoaded, false);
    await started.promise;
    assert.equal(store.demo.user.id, nextAccount.id);
    assertTraffic(store, { series: [], servers: [], members: [] });
    assert.equal(store.demo.trafficLoaded, false);
  } finally {
    release.resolve();
    await switching;
  }
  assertTraffic(store, next);
  assert.equal(store.demo.trafficLoaded, true);
});

for (const ending of ['logout', 'expired']) {
  test(`an in-flight traffic response cannot restore private data after ${ending}`, async t => {
    const started = deferred();
    const release = deferred();
    let requests = 0;
    const { store, storage } = await fresh(t, async path => {
      if (path === '/api/logout') return respond({ success: true });
      if (path === '/api/status') return respond({ initialized: true, version: 'test' });
      if (path === '/api/expired') return respond({ error: { message: 'expired' } }, 401);
      assert.equal(path, '/api/state');
      return respond(state());
    }, async () => {
      if (++requests === 1) return respond(traffic('private'));
      started.resolve();
      await release.promise;
      return respond(traffic('stale-private', 9));
    });
    await store.acceptSession({ token: 'test.jwt', user: account });
    const refreshing = store.refreshState();
    try {
      await started.promise;
      if (ending === 'logout') await store.logout();
      else await assert.rejects(store.api('/api/expired'), /expired/);
      assert.equal(store.demo.user, null);
      assertTraffic(store, { series: [], servers: [], members: [] });
      assert.equal(store.demo.trafficLoaded, false);
    } finally {
      release.resolve();
      await refreshing;
    }
    assert.equal(store.demo.user, null);
    assertTraffic(store, { series: [], servers: [], members: [] });
    assert.equal(store.demo.trafficLoaded, false);
    assert.equal(store.demo.trafficError, '');
    assert.equal(storage.size, 0);
  });
}

test('a forbidden traffic response discards cached traffic without ending the session', async t => {
  let forbidden = false;
  const { store } = await fresh(t, async () => respond(state()), async () => forbidden
    ? respond({ error: { message: 'traffic access denied' } }, 403)
    : respond(traffic('private')));
  await store.acceptSession({ token: 'test.jwt', user: account });
  forbidden = true;
  await store.refreshState();
  assertTraffic(store, { series: [], servers: [], members: [] });
  assert.equal(store.demo.user.id, account.id);
  assert.match(store.demo.trafficError, /traffic access denied/);
});

for (const status of [200, 401, 403]) {
  test(`an old traffic ${status} response cannot change traffic from a newer account`, async t => {
    const nextAccount = { id: 'user-2', username: 'next-user', role: 'admin' };
    const started = deferred();
    const release = deferred();
    const next = traffic('new-account', 7);
    let oldRequests = 0;
    const { store } = await fresh(t, async (path, init) => {
      assert.equal(path, '/api/state');
      return respond(state({}, init.headers.get('MM-Authorization') === 'next.jwt' ? nextAccount : account));
    }, async (path, init) => {
      if (init.headers.get('MM-Authorization') === 'next.jwt') return respond(next);
      if (++oldRequests === 1) return respond(traffic('old-account'));
      started.resolve();
      await release.promise;
      return status === 200 ? respond(traffic('stale-account', 99)) : respond({ error: { message: 'old session failure' } }, status);
    });
    await store.acceptSession({ token: 'old.jwt', user: account });
    const obsolete = store.refreshState();
    try {
      await started.promise;
      await store.acceptSession({ token: 'next.jwt', user: nextAccount });
      assertTraffic(store, next);
    } finally {
      release.resolve();
      await obsolete;
    }
    assert.equal(store.demo.user.id, nextAccount.id);
    assertTraffic(store, next);
    assert.equal(store.demo.trafficLoaded, true);
    assert.equal(store.demo.trafficError, '');
  });
}

function assertMinuteTraffic(store, expected) {
  assert.deepEqual(store.demo.data.trafficMinutes, expected.series);
  assert.equal(store.demo.minuteTrafficFrom, expected.from);
  assert.equal(store.demo.minuteTrafficTo, expected.to);
}

test('minute traffic refresh is independent of summary totals and retains previous samples while pending', async t => {
  const started = deferred(), release = deferred();
  const previous = minuteTraffic('previous-minute'), next = minuteTraffic('next-minute', 2, previous.to + 60000);
  let requests = 0;
  const summary = traffic('daily-summary', 200);
  const { store } = await fresh(t, async () => respond(state()), async path => {
    assert.equal(path, '/api/traffic?range=30d');
    return respond(summary);
  }, async () => {
    if (++requests === 1) return respond(previous);
    started.resolve(); await release.promise; return respond(next);
  });
  await store.acceptSession({ token: 'test.jwt', user: account });
  const refreshing = store.refreshState();
  try {
    await started.promise;
    assertMinuteTraffic(store, previous);
    assert.equal(store.demo.minuteTrafficLoaded, true);
    assertTraffic(store, summary);
  } finally { release.resolve(); await refreshing; }
  assertMinuteTraffic(store, next);
  assertTraffic(store, summary);
});

for (const failure of ['network', 'server', 'daily-response']) {
  test(`minute traffic retains prior data after ${failure} and accepts a confirmed empty response`, async t => {
    const previous = minuteTraffic('minute'), summary = traffic('summary', 100);
    let phase = 'initial';
    const { store } = await fresh(t, async () => respond(state()), async () => respond(summary), async () => {
      if (phase === 'failed') {
        if (failure === 'network') throw new TypeError('offline');
        return failure === 'server' ? respond({ error: { message: 'minute unavailable' } }, 500) : respond(traffic('wrong-daily'));
      }
      return respond(phase === 'empty' ? minuteTraffic('', 0, previous.to + 60000) : previous);
    });
    await store.acceptSession({ token: 'test.jwt', user: account });
    phase = 'failed'; await store.refreshState();
    assertMinuteTraffic(store, previous);
    assert.equal(store.demo.minuteTrafficLoaded, true);
    assert.notEqual(store.demo.minuteTrafficError, '');
    assertTraffic(store, summary);
    assert.equal(store.demo.trafficError, '');
    phase = 'empty'; await store.refreshState();
    assertMinuteTraffic(store, minuteTraffic('', 0, previous.to + 60000));
    assert.equal(store.demo.minuteTrafficError, '');
    assert.equal(store.demo.minuteTrafficLoaded, true);
  });
}

test('forbidden minute data clears only that cache and its time bounds', async t => {
  let denied = false;
  const summary = traffic('summary');
  const { store } = await fresh(t, async () => respond(state()), async () => respond(summary), async () => denied ? respond({ error: { message: 'minute denied' } }, 403) : respond(minuteTraffic('private')));
  await store.acceptSession({ token: 'test.jwt', user: account });
  denied = true; await store.refreshState();
  assertMinuteTraffic(store, { series: [], from: null, to: null });
  assert.equal(store.demo.minuteTrafficLoaded, false);
  assert.match(store.demo.minuteTrafficError, /minute denied/);
  assertTraffic(store, summary);
  assert.equal(store.demo.user.id, account.id);
});

for (const ending of ['logout', 'expired']) {
  test(`a delayed minute response cannot restore private data after ${ending}`, async t => {
    const started = deferred(), release = deferred();
    let requests = 0;
    const { store, storage } = await fresh(t, async path => {
      if (path === '/api/logout') return respond({ success: true });
      if (path === '/api/status') return respond({ initialized: true, version: 'test' });
      if (path === '/api/expired') return respond({ error: { message: 'expired' } }, 401);
      return respond(state());
    }, undefined, async () => {
      if (++requests === 1) return respond(minuteTraffic('private'));
      started.resolve(); await release.promise; return respond(minuteTraffic('stale-private'));
    });
    await store.acceptSession({ token: 'test.jwt', user: account });
    const refreshing = store.refreshState();
    try {
      await started.promise;
      if (ending === 'logout') await store.logout();
      else await assert.rejects(store.api('/api/expired'), /expired/);
      assertMinuteTraffic(store, { series: [], from: null, to: null });
    } finally { release.resolve(); await refreshing; }
    assertMinuteTraffic(store, { series: [], from: null, to: null });
    assert.equal(store.demo.minuteTrafficLoaded, false);
    assert.equal(store.demo.minuteTrafficError, '');
    assert.equal(storage.size, 0);
  });
}

for (const status of [200, 401, 403]) {
  test(`a delayed minute ${status} response cannot overwrite a newer identity`, async t => {
    const started = deferred(), release = deferred(), nextStarted = deferred(), nextRelease = deferred();
    const nextAccount = { id: 'user-2', username: 'next-user', role: 'admin' }, next = minuteTraffic('new-private', 7);
    let requests = 0;
    const { store } = await fresh(t, async (path, init) => respond(state({}, init.headers.get('MM-Authorization') === 'next.jwt' ? nextAccount : account)), undefined, async (path, init) => {
      if (init.headers.get('MM-Authorization') === 'next.jwt') { nextStarted.resolve(); await nextRelease.promise; return respond(next); }
      if (++requests === 1) return respond(minuteTraffic('old-private'));
      started.resolve(); await release.promise;
      return status === 200 ? respond(minuteTraffic('stale-private')) : respond({ error: { message: 'old failure' } }, status);
    });
    await store.acceptSession({ token: 'old.jwt', user: account });
    const obsolete = store.refreshState();
    let switching;
    try {
      await started.promise;
      switching = store.acceptSession({ token: 'next.jwt', user: nextAccount });
      await nextStarted.promise;
      assertMinuteTraffic(store, { series: [], from: null, to: null });
      assert.equal(store.demo.minuteTrafficLoaded, false);
      nextRelease.resolve(); await switching;
      assertMinuteTraffic(store, next);
    } finally { nextRelease.resolve(); release.resolve(); await switching; await obsolete; }
    assert.equal(store.demo.user.id, nextAccount.id);
    assertMinuteTraffic(store, next);
    assert.equal(store.demo.minuteTrafficError, '');
  });
}
