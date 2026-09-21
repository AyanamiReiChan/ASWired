import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { compileModule } from 'svelte/compiler';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../src/lib/subscription-output.svelte.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const compiled = compileModule(js, { filename: 'subscription-output.svelte.js', generate: 'client' }).js.code.replace("'svelte/internal/client'", JSON.stringify(pathToFileURL(require.resolve('svelte/internal/client')).href));
const { createSubscriptionOutput } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const selection = (format = 'clash', token = 'fixture-token', id = 'subscription-1') => ({
  id, format, url: `https://panel.example.test/api/clash/subscribe?token=${encodeURIComponent(token)}&format=${encodeURIComponent(format)}`,
});
const empty = { url: '', loading: false, ready: false, config: '', qr: '', error: '', qrError: '' };
const snapshot = output => ({ ...output.state });

test('the selected template is checked with the same configuration used by the public link', async () => {
  const paths = [];
  const output = createSubscriptionOutput(async path => { paths.push(path); return 'mode: rule'; }, async url => url);
  const selected = { ...selection(), template: 'template/with spaces' };
  selected.url += '&template=' + encodeURIComponent(selected.template);
  await output.load(selected);
  assert.deepEqual(paths, ['/api/subscriptions/subscription-1/config?format=clash&template=template%2Fwith%20spaces']);
  assert.equal(output.state.ready, true);
  assert.equal(output.state.qr, selected.url);
});

test('the selected format is checked before its link and QR become ready', async () => {
  const response = deferred();
  const qrResult = deferred();
  const qrStarted = deferred();
  const paths = [];
  const urls = [];
  const selected = selection('singbox', 'fixture-token', 'member/subscription');
  const output = createSubscriptionOutput(path => { paths.push(path); return response.promise; }, url => {
    urls.push(url);
    qrStarted.resolve();
    return qrResult.promise;
  });
  assert.deepEqual(snapshot(output), empty);
  const loading = output.load(selected);
  assert.equal(output.state.url, selected.url);
  assert.equal(output.state.loading, true);
  assert.equal(output.state.ready, false);
  assert.deepEqual(paths, ['/api/subscriptions/member%2Fsubscription/config?format=singbox']);
  assert.deepEqual(urls, []);
  response.resolve('{"outbounds":[]}');
  await qrStarted.promise;
  assert.equal(output.state.ready, false);
  assert.equal(output.state.loading, true);
  assert.deepEqual(urls, [selected.url]);
  qrResult.resolve('data:image/png;base64,new-qr');
  await loading;
  assert.equal(output.state.ready, true);
  assert.equal(output.state.loading, false);
  assert.equal(output.state.config, '{"outbounds":[]}');
  assert.equal(output.state.qr, 'data:image/png;base64,new-qr');
});

for (const outcome of ['success', 'error']) {
  for (const stage of ['loading', 'ready']) {
    test(`an older config ${outcome} cannot replace a newer ${stage} selection or finish its loading state`, async () => {
      const oldResponse = deferred();
      const newResponse = deferred();
      const urls = [];
      const output = createSubscriptionOutput(path => path.endsWith('format=clash') ? oldResponse.promise : newResponse.promise, async url => {
        urls.push(url);
        return `qr:${url}`;
      });
      const previous = output.load(selection('clash'));
      const selected = selection('surge');
      const next = output.load(selected);
      if (stage === 'ready') {
        newResponse.resolve('[Proxy]\nnew-surge');
        await next;
      }
      const expected = snapshot(output);
      if (outcome === 'success') oldResponse.resolve('proxies: old-clash');
      else oldResponse.reject(new Error('old config request failed'));
      await previous;
      assert.deepEqual(snapshot(output), expected);
      assert.equal(output.state.url, selected.url);
      if (stage === 'loading') {
        assert.equal(output.state.loading, true);
        assert.equal(output.state.ready, false);
        newResponse.resolve('[Proxy]\nnew-surge');
        await next;
      }
      assert.equal(output.state.config, '[Proxy]\nnew-surge');
      assert.equal(output.state.ready, true);
      assert.equal(output.state.error, '');
      assert.deepEqual(urls, [selected.url]);
    });
  }
}

for (const outcome of ['success', 'error']) {
  test(`an older QR ${outcome} cannot overwrite a new pending selection`, async () => {
    const oldQR = deferred();
    const oldQRStarted = deferred();
    const newResponse = deferred();
    const current = selection('surge');
    const output = createSubscriptionOutput(path => path.endsWith('format=clash') ? Promise.resolve('proxies: old') : newResponse.promise, url => {
      if (url === current.url) return Promise.resolve('new-qr');
      oldQRStarted.resolve();
      return oldQR.promise;
    });
    const previous = output.load(selection('clash'));
    await oldQRStarted.promise;
    const next = output.load(current);
    const expected = snapshot(output);
    if (outcome === 'success') oldQR.resolve('old-qr');
    else oldQR.reject(new Error('old QR failed'));
    await previous;
    assert.deepEqual(snapshot(output), expected);
    assert.equal(output.state.loading, true);
    assert.equal(output.state.ready, false);
    assert.equal(output.state.qrError, '');
    newResponse.resolve('[Proxy]\nnew');
    await next;
    assert.equal(output.state.config, '[Proxy]\nnew');
    assert.equal(output.state.qr, 'new-qr');
    assert.equal(output.state.ready, true);
  });
}

test('a 422 incompatible format cannot expose a ready link or generate a QR', async () => {
  const response = deferred();
  let qrCalls = 0;
  const output = createSubscriptionOutput(() => response.promise, async () => { qrCalls++; return 'unexpected'; });
  const loading = output.load(selection('surge'));
  response.reject(Object.assign(new Error('没有可生成的节点：surge不支持 VLESS/Reality'), { status: 422, code: 'incompatible_config' }));
  await loading;
  assert.equal(output.state.ready, false);
  assert.equal(output.state.loading, false);
  assert.equal(output.state.config, '');
  assert.equal(output.state.qr, '');
  assert.match(output.state.error, /surge不支持 VLESS\/Reality/);
  assert.equal(qrCalls, 0);
});

for (const stage of ['config', 'QR']) {
  for (const outcome of ['success', 'error']) {
    test(`clearing the output ignores a delayed ${stage} ${outcome}`, async () => {
      const delayed = deferred();
      const qrStarted = deferred();
      let qrCalls = 0;
      const output = createSubscriptionOutput(() => stage === 'config' ? delayed.promise : Promise.resolve('proxies: fixture'), () => {
        qrCalls++;
        qrStarted.resolve();
        return delayed.promise;
      });
      const loading = output.load(selection());
      if (stage === 'QR') await qrStarted.promise;
      output.clear();
      assert.deepEqual(snapshot(output), empty);
      if (outcome === 'success') delayed.resolve('obsolete-result');
      else delayed.reject(new Error('obsolete-error'));
      await loading;
      assert.deepEqual(snapshot(output), empty);
      assert.equal(qrCalls, stage === 'config' ? 0 : 1);
    });
  }
}

test('QR failure keeps the checked configuration and link ready for copying', async () => {
  const selected = selection('surge');
  const output = createSubscriptionOutput(async () => '[Proxy]\nusable-config', async () => { throw new Error('canvas unavailable'); });
  await output.load(selected);
  assert.equal(output.state.url, selected.url);
  assert.equal(output.state.config, '[Proxy]\nusable-config');
  assert.equal(output.state.ready, true);
  assert.equal(output.state.loading, false);
  assert.equal(output.state.error, '');
  assert.equal(output.state.qr, '');
  assert.match(output.state.qrError, /二维码生成失败/);
});

test('rotating the token clears the old output and checks new content for the new URL', async () => {
  const response = deferred();
  const paths = [];
  const urls = [];
  const output = createSubscriptionOutput(path => {
    paths.push(path);
    return paths.length === 1 ? Promise.resolve('proxies: before-rotation') : response.promise;
  }, async url => { urls.push(url); return `qr:${url}`; });
  const old = selection('clash', 'old-fixture-token');
  await output.load(old);
  assert.equal(output.state.ready, true);
  const current = selection('clash', 'new-fixture-token');
  const loading = output.load(current);
  assert.equal(output.state.url, current.url);
  assert.equal(output.state.ready, false);
  assert.equal(output.state.config, '');
  assert.equal(output.state.qr, '');
  assert.equal(output.state.loading, true);
  response.resolve('proxies: after-rotation');
  await loading;
  assert.equal(paths.length, 2);
  assert.deepEqual(urls, [old.url, current.url]);
  assert.equal(output.state.config, 'proxies: after-rotation');
  assert.equal(output.state.qr, `qr:${current.url}`);
  assert.equal(output.state.ready, true);
});

test('empty configuration is unavailable and retrying can recover without stale errors', async () => {
  let calls = 0;
  let qrCalls = 0;
  const output = createSubscriptionOutput(async () => ++calls === 1 ? ' \n\t' : 'proxies: recovered', async () => { qrCalls++; return 'recovered-qr'; });
  await output.load(selection());
  assert.equal(output.state.ready, false);
  assert.equal(output.state.loading, false);
  assert.match(output.state.error, /没有可用配置/);
  assert.equal(qrCalls, 0);
  const retrying = output.load(selection());
  assert.equal(output.state.error, '');
  assert.equal(output.state.loading, true);
  await retrying;
  assert.equal(output.state.config, 'proxies: recovered');
  assert.equal(output.state.error, '');
  assert.equal(output.state.qrError, '');
  assert.equal(output.state.ready, true);
  assert.equal(qrCalls, 1);
});
