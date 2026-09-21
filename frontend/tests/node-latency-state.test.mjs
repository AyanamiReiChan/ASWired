import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { compileModule } from 'svelte/compiler';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const asModule = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const source = ts.transpileModule(fs.readFileSync(new URL('../src/lib/node-latency-state.svelte.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const compiled = compileModule(source, { filename: 'node-latency-state.svelte.js', generate: 'client' }).js.code
  .replace(/(['"])svelte\/internal\/client\1/g, JSON.stringify(pathToFileURL(require.resolve('svelte/internal/client')).href));
const { createNodeLatencyTests } = await import(asModule(compiled));
const reactiveHarness = compileModule(`
  import { createNodeLatencyTests } from ${JSON.stringify(asModule(compiled))};
  export function bindIdentity(read, initialUser) {
    let user = $state(initialUser);
    const queue = createNodeLatencyTests({ read, identity: () => user ? user.id + ':' + user.role : '', canTest: () => true });
    const dispose = $effect.root(() => { $effect(() => queue.syncIdentity()); });
    return { queue, setUser(value) { user = value; }, dispose };
  }
`, { filename: 'node-latency-identity.svelte.js', generate: 'client' }).js.code
  .replace(/(['"])svelte\/internal\/client\1/g, JSON.stringify(pathToFileURL(require.resolve('svelte/internal/client')).href));
const { bindIdentity } = await import(asModule(reactiveHarness));
const { flush } = await import(pathToFileURL(require.resolve('svelte/internal/client')).href);

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const snapshot = queue => JSON.parse(JSON.stringify(queue.state));
const empty = { running: false, stopping: false, total: 0, completed: 0, succeeded: 0, failed: 0, results: {} };
const makeQueue = (read, overrides = {}) => createNodeLatencyTests({ read, identity: () => 'member-a', canTest: () => true, ...overrides });

test('a single node exposes running state and retains its actual latency after completion', async () => {
  const pending = deferred();
  const calls = [];
  const queue = makeQueue((id, signal) => { calls.push({ id, signal }); return pending.promise; });
  assert.deepEqual(snapshot(queue), empty);
  const running = queue.run(['node-a']);
  assert.equal(queue.state.running, true);
  assert.equal(queue.state.total, 1);
  assert.equal(queue.state.results['node-a'].status, 'running');
  assert.equal(calls[0].id, 'node-a');
  assert.equal(calls[0].signal.aborted, false);
  pending.resolve({ latency: 28.793 });
  assert.deepEqual(await running, { completed: 1, total: 1, succeeded: 1, failed: 0 });
  assert.deepEqual(snapshot(queue), { ...empty, total: 1, completed: 1, succeeded: 1, results: { 'node-a': { status: 'success', latency: 28.793 } } });
});

test('testing all nodes deduplicates and processes more than one page in order with only one active request', async () => {
  const ids = Array.from({ length: 23 }, (_, index) => `node-${index}`);
  const calls = [];
  let active = 0, maximumActive = 0;
  const queue = makeQueue(async id => {
    active++;
    maximumActive = Math.max(maximumActive, active);
    calls.push(id);
    await Promise.resolve();
    active--;
    return { latency: calls.length };
  });
  const result = await queue.run([...ids, ids[0], ids[12], '']);
  assert.deepEqual(calls, ids);
  assert.equal(maximumActive, 1);
  assert.deepEqual(result, { total: 23, completed: 23, succeeded: 23, failed: 0 });
  assert.equal(Object.keys(queue.state.results).length, 23);
  assert.equal(queue.state.results['node-22'].status, 'success');
});

test('one failed node does not stop the remaining nodes and success and failure counts remain distinct', async () => {
  const calls = [];
  const queue = makeQueue(async id => {
    calls.push(id);
    if (id === 'bad') throw new Error('连接超时');
    return { latency: 0 };
  });
  const result = await queue.run(['first', 'bad', 'last']);
  assert.deepEqual(calls, ['first', 'bad', 'last']);
  assert.deepEqual(result, { total: 3, completed: 3, succeeded: 2, failed: 1 });
  assert.deepEqual(snapshot(queue).results.bad, { status: 'failed', error: '连接超时' });
  assert.deepEqual(snapshot(queue).results.last, { status: 'success', latency: 0 });
});

for (const outcome of ['resolve', 'reject']) {
  test(`stopping aborts the active request and cancels queued nodes even if that request later ${outcome}s`, async () => {
    const pending = deferred();
    const calls = [];
    const queue = makeQueue((id, signal) => {
      calls.push({ id, signal });
      return id === 'first' ? Promise.resolve({ latency: 1 }) : pending.promise;
    });
    const running = queue.run(['first', 'active', 'queued']);
    await Promise.resolve();
    assert.equal(calls.length, 2);
    queue.stop();
    assert.equal(calls[1].signal.aborted, true);
    assert.equal(queue.state.stopping, true);
    if (outcome === 'resolve') pending.resolve({ latency: 2 });
    else pending.reject(new DOMException('Aborted', 'AbortError'));
    assert.deepEqual(await running, { total: 3, completed: 1, succeeded: 1, failed: 0 });
    assert.deepEqual(calls.map(call => call.id), ['first', 'active']);
    assert.equal(queue.state.running, false);
    assert.equal(queue.state.results.first.status, 'success');
    assert.equal(queue.state.results.active.status, 'cancelled');
    assert.equal(queue.state.results.queued.status, 'cancelled');
  });
}

test('repeated clicks while a batch is active do not duplicate or append requests', async () => {
  const pending = deferred();
  const calls = [];
  const queue = makeQueue(id => { calls.push(id); return id === 'first' ? pending.promise : Promise.resolve({ latency: 2 }); });
  const running = queue.run(['first', 'second']);
  await queue.run(['first', 'second', 'third']);
  await queue.run(['first']);
  assert.deepEqual(calls, ['first']);
  assert.equal(queue.state.total, 2);
  assert.equal(queue.state.results.third, undefined);
  pending.resolve({ latency: 1 });
  await running;
  assert.deepEqual(calls, ['first', 'second']);
});

for (const outcome of ['resolve', 'reject']) {
  test(`an identity change during a request clears results and ignores its late ${outcome}`, async () => {
    let identity = 'member-a';
    const pending = deferred();
    const calls = [];
    const queue = makeQueue((id, signal) => { calls.push({ id, signal }); return pending.promise; }, { identity: () => identity });
    const running = queue.run(['first', 'second']);
    identity = 'member-b';
    if (outcome === 'resolve') pending.resolve({ latency: 1 });
    else pending.reject(new Error('old request failed'));
    await running;
    assert.deepEqual(snapshot(queue), empty);
    assert.deepEqual(calls.map(call => call.id), ['first']);
    assert.equal(calls[0].signal.aborted, true);
  });
}

for (const outcome of ['resolve', 'reject']) {
  for (const stage of ['pending', 'completed']) {
    test(`clearing isolates an old ${outcome} from a new ${stage} batch`, async () => {
      const previous = deferred();
      const current = deferred();
      const calls = [];
      let identity = 'member-a';
      const queue = makeQueue((id, signal) => { calls.push({ id, signal }); return calls.length === 1 ? previous.promise : current.promise; }, { identity: () => identity });
      const oldRun = queue.run(['old-node', 'old-queued']);
      queue.clear();
      assert.equal(calls[0].signal.aborted, true);
      assert.deepEqual(snapshot(queue), empty);
      identity = 'member-b';
      const newRun = queue.run(['new-node']);
      if (stage === 'completed') { current.resolve({ latency: 9 }); await newRun; }
      const expected = snapshot(queue);
      if (outcome === 'resolve') previous.resolve({ latency: 123 });
      else previous.reject(new Error('stale request failure'));
      await oldRun;
      assert.deepEqual(snapshot(queue), expected);
      assert.equal(calls[1].signal.aborted, false);
      if (stage === 'pending') { current.resolve({ latency: 9 }); await newRun; }
      assert.deepEqual(calls.map(call => call.id), ['old-node', 'new-node']);
      assert.deepEqual(snapshot(queue).results, { 'new-node': { status: 'success', latency: 9 } });
    });
  }
}

for (const outcome of ['resolve', 'reject']) {
  test(`a timed-out request cannot succeed even when abort makes read ${outcome}`, async () => {
    const queue = makeQueue((_id, signal) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => outcome === 'resolve' ? resolve({ latency: 1 }) : reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }), { timeoutMs: 5 });
    const result = await queue.run(['slow']);
    assert.deepEqual(result, { total: 1, completed: 1, succeeded: 0, failed: 1 });
    assert.equal(queue.state.results.slow.status, 'failed');
    assert.match(queue.state.results.slow.error, /超时/);
    assert.equal(queue.state.running, false);
  });
}

test('invalid latency values are failures and do not prevent a later valid zero measurement', async () => {
  const values = [NaN, Infinity, -1, '12', null, undefined, 0];
  const queue = makeQueue(async id => ({ latency: values[Number(id)] }));
  const result = await queue.run(values.map((_value, index) => String(index)));
  assert.deepEqual(result, { total: 7, completed: 7, succeeded: 1, failed: 6 });
  for (let index = 0; index < values.length - 1; index++) assert.equal(queue.state.results[String(index)].status, 'failed');
  assert.deepEqual(snapshot(queue).results['6'], { status: 'success', latency: 0 });
});

test('missing identity or denied node permission cannot send requests', async () => {
  const calls = [];
  let identity = '';
  let allowed = true;
  const queue = makeQueue(async id => { calls.push(id); return { latency: 1 }; }, { identity: () => identity, canTest: () => allowed });
  await queue.run(['node-a']);
  identity = 'member-a';
  allowed = false;
  await queue.run(['node-a']);
  assert.deepEqual(calls, []);
  assert.deepEqual(snapshot(queue), empty);
});

test('permission is checked again before each queued node is sent', async () => {
  const pending = deferred();
  const allowed = new Set(['first', 'revoked', 'last']);
  const calls = [];
  const queue = makeQueue(id => { calls.push(id); return id === 'first' ? pending.promise : Promise.resolve({ latency: 3 }); }, { canTest: id => allowed.has(id) });
  const running = queue.run(['first', 'revoked', 'last']);
  allowed.delete('revoked');
  pending.resolve({ latency: 1 });
  await running;
  assert.deepEqual(calls, ['first', 'last']);
  assert.equal(queue.state.results.revoked.status, 'cancelled');
  assert.equal(queue.state.succeeded, 2);
  assert.equal(queue.state.failed, 0);
});

for (const status of [401, 403]) {
  test(`a ${status} response stops the batch before more requests are sent`, async () => {
    const calls = [];
    const queue = makeQueue(async id => { calls.push(id); throw Object.assign(new Error('没有测速权限'), { status }); });
    const result = await queue.run(['first', 'second']);
    assert.deepEqual(calls, ['first']);
    assert.deepEqual(result, { total: 2, completed: 1, succeeded: 0, failed: 1 });
    assert.equal(queue.state.results.first.status, 'failed');
    assert.equal(queue.state.results.second.status, 'cancelled');
    assert.equal(queue.state.running, false);
  });
}

test('a real Svelte effect preserves the active batch when polling replaces the user object with the same id and role', async () => {
  const pending = deferred();
  const calls = [];
  const binding = bindIdentity((id, signal) => { calls.push({ id, signal }); return id === 'active' ? pending.promise : Promise.resolve({ latency: 2 }); }, { id: 'member-a', role: 'user', name: 'before' });
  try {
    flush();
    const running = binding.queue.run(['active', 'queued']);
    const expected = snapshot(binding.queue);
    for (let refresh = 0; refresh < 5; refresh++) {
      binding.setUser({ id: 'member-a', role: 'user', name: `refresh-${refresh}` });
      flush();
      assert.equal(calls[0].signal.aborted, false);
      assert.deepEqual(snapshot(binding.queue), expected);
    }
    pending.resolve({ latency: 1 });
    assert.deepEqual(await running, { total: 2, completed: 2, succeeded: 2, failed: 0 });
    assert.deepEqual(calls.map(call => call.id), ['active', 'queued']);
  } finally {
    binding.queue.clear();
    binding.dispose();
  }
});

for (const nextUser of [{ id: 'member-b', role: 'user' }, { id: 'member-a', role: 'admin' }, null]) {
  test(`a real Svelte effect immediately clears and aborts when identity becomes ${JSON.stringify(nextUser)}`, async () => {
    const pending = deferred();
    const calls = [];
    const binding = bindIdentity((id, signal) => { calls.push({ id, signal }); return pending.promise; }, { id: 'member-a', role: 'user' });
    try {
      flush();
      const running = binding.queue.run(['active', 'queued']);
      binding.setUser(nextUser);
      flush();
      assert.equal(calls[0].signal.aborted, true);
      assert.deepEqual(snapshot(binding.queue), empty);
      pending.resolve({ latency: 3 });
      await running;
      assert.deepEqual(calls.map(call => call.id), ['active']);
      assert.deepEqual(snapshot(binding.queue), empty);
    } finally {
      binding.queue.clear();
      binding.dispose();
    }
  });
}

test('starting a new identity batch drops completed results even before its identity effect runs', async () => {
  let identity = 'member-a:user';
  const queue = makeQueue(async () => ({ latency: 1 }), { identity: () => identity });
  await queue.run(['old-node']);
  identity = 'member-b:user';
  await queue.run(['new-node']);
  assert.deepEqual(snapshot(queue).results, { 'new-node': { status: 'success', latency: 1 } });
});
