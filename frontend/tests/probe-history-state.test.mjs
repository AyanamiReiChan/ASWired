import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { compileModule } from 'svelte/compiler';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const transpile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const asModule = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const helpers = asModule(transpile(fs.readFileSync(new URL('../src/lib/probe-history.ts', import.meta.url), 'utf8')));
const source = transpile(fs.readFileSync(new URL('../src/lib/probe-history-state.svelte.ts', import.meta.url), 'utf8'));
const compiled = compileModule(source, { filename: 'probe-history-state.svelte.js', generate: 'client' }).js.code
  .replace(/(['"])svelte\/internal\/client\1/g, JSON.stringify(pathToFileURL(require.resolve('svelte/internal/client')).href))
  .replace(/(['"])\.\/probe-history\1/g, JSON.stringify(helpers));
const { createProbeHistory, ProbeHistoryError } = await import(asModule(compiled));

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const selection = overrides => ({ server: '0', identity: 'public-server-a', metric: 'cpu_pct', range: '1h', network: false, ...overrides });
const samples = value => [{ t: 1000, value }, { t: 1300, value: value + 1 }];
const payload = (value, metric = 'cpu_pct') => ({ series: { [metric]: samples(value) }, method: 'tcp', bucket_sec: 300 });
const snapshot = history => JSON.parse(JSON.stringify(history.state));
const empty = { series: [], method: '', bucketSeconds: 300, loading: false, loaded: false, error: '' };

test('a background refresh keeps the existing curve until updated history arrives', async () => {
  const pending = deferred();
  const calls = [];
  const history = createProbeHistory((path, signal) => {
    calls.push({ path, signal });
    return calls.length === 1 ? Promise.resolve(payload(1)) : pending.promise;
  });
  assert.deepEqual(snapshot(history), empty);
  await history.load(selection());
  const refresh = history.load(selection());
  assert.equal(history.state.loading, true);
  assert.equal(history.state.loaded, true);
  assert.deepEqual(snapshot(history).series, samples(1));
  assert.equal(history.state.method, 'tcp');
  assert.equal(calls[1].path, '/api/public/probe-series?server=0&metric=system&target=0&range=1h');
  pending.resolve({ ...payload(5), method: 'icmp', bucket_sec: 600 });
  await refresh;
  assert.deepEqual(snapshot(history), { series: samples(5), method: 'icmp', bucketSeconds: 600, loading: false, loaded: true, error: '' });
});

for (const failure of ['network', '503', 'invalid JSON', 'missing series', 'invalid series']) {
  test(`a ${failure} refresh failure retains the previous curve and reports an error`, async () => {
    let calls = 0;
    const history = createProbeHistory(async () => {
      if (++calls === 1 || calls === 3) return payload(calls);
      if (failure === 'network') throw new TypeError('Failed to fetch');
      if (failure === '503') throw new ProbeHistoryError('service unavailable', 503);
      if (failure === 'invalid JSON') throw new SyntaxError('Invalid JSON');
      return failure === 'missing series' ? {} : { series: [] };
    });
    await history.load(selection());
    await history.load(selection());
    assert.deepEqual(snapshot(history).series, samples(1));
    assert.equal(history.state.loaded, true);
    assert.equal(history.state.loading, false);
    assert.notEqual(history.state.error, '');
    await history.load(selection());
    assert.deepEqual(snapshot(history).series, samples(3));
    assert.equal(history.state.error, '');
  });
}

test('a confirmed empty history replaces old data instead of retaining a false curve', async () => {
  let calls = 0;
  const history = createProbeHistory(async () => ++calls === 1 ? payload(8) : { series: {} });
  await history.load(selection());
  await history.load(selection());
  assert.deepEqual(snapshot(history), { ...empty, loaded: true });
});

for (const [field, value] of [['server', '1'], ['identity', 'public-server-b'], ['metric', 'download_speed'], ['range', '24h']]) {
  test(`changing ${field} clears the previous curve before the new response arrives`, async () => {
    const pending = deferred();
    let calls = 0;
    const history = createProbeHistory(() => ++calls === 1 ? Promise.resolve(payload(1)) : pending.promise);
    await history.load(selection());
    const next = selection({ [field]: value });
    const loading = history.load(next);
    assert.deepEqual(snapshot(history), { ...empty, loading: true });
    pending.resolve(payload(4, next.metric));
    await loading;
    assert.deepEqual(snapshot(history).series, samples(4));
    assert.equal(history.state.loaded, true);
  });
}

for (const outcome of ['success', 'error']) {
  for (const stage of ['pending', 'ready']) {
    test(`an older ${outcome} cannot overwrite a newer ${stage} selection`, async () => {
      const oldResponse = deferred();
      const newResponse = deferred();
      const signals = [];
      const history = createProbeHistory((_path, signal) => {
        signals.push(signal);
        return signals.length === 1 ? oldResponse.promise : newResponse.promise;
      });
      const previous = history.load(selection());
      const current = history.load(selection({ metric: 'download_speed' }));
      assert.equal(signals[0].aborted, true);
      assert.equal(signals[1].aborted, false);
      if (stage === 'ready') {
        newResponse.resolve(payload(9, 'download_speed'));
        await current;
      }
      const expected = snapshot(history);
      if (outcome === 'success') oldResponse.resolve(payload(2));
      else oldResponse.reject(new ProbeHistoryError('obsolete denial', 404));
      await previous;
      assert.deepEqual(snapshot(history), expected);
      if (stage === 'pending') {
        assert.equal(history.state.loading, true);
        newResponse.resolve(payload(9, 'download_speed'));
        await current;
      }
      assert.deepEqual(snapshot(history).series, samples(9));
      assert.equal(history.state.error, '');
    });
  }
}

for (const outcome of ['success', 'error']) {
  test(`clearing public history aborts its request and ignores a delayed ${outcome}`, async () => {
    const pending = deferred();
    const signals = [];
    const history = createProbeHistory((_path, signal) => {
      signals.push(signal);
      return signals.length === 1 ? Promise.resolve(payload(1)) : pending.promise;
    });
    await history.load(selection());
    const loading = history.load(selection());
    history.clear();
    assert.equal(signals[1].aborted, true);
    assert.deepEqual(snapshot(history), empty);
    if (outcome === 'success') pending.resolve(payload(2));
    else pending.reject(new Error('late network failure'));
    await loading;
    assert.deepEqual(snapshot(history), empty);
  });
}

for (const status of [401, 403, 404]) {
  test(`a ${status} response removes previously displayed public history`, async () => {
    let calls = 0;
    const history = createProbeHistory(async () => {
      if (++calls === 1) return payload(6);
      throw new ProbeHistoryError('public access withdrawn', status);
    });
    await history.load(selection());
    await history.load(selection());
    assert.deepEqual(snapshot(history).series, []);
    assert.equal(history.state.loaded, false);
    assert.equal(history.state.loading, false);
    assert.equal(history.state.error, 'public access withdrawn');
  });
}
