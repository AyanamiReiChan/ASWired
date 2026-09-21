import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/lib/reality-scanner.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { realityPoolSelection, scanExpired, scanResultSelection, selectedScanResultIds, visibleScanResults } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const now = Date.parse('2026-09-16T00:00:00Z');
const verified = { id: 'verified', target: '[2606:4700:4700::1111]:8443', host: 'one.one.one.one', serverNames: ['one.one.one.one', 'unverified.example'], feasible: true, tls13: true, h2: true, x25519: true, certValid: true, certChainValid: true };
const evidence = { source: 'agent', serverId: 'server-a', expiresAt: new Date(now + 60000).toISOString(), results: [verified] };

test('inline selection preserves address and port and applies only the verified SNI', () => {
  assert.deepEqual(scanResultSelection(evidence, 'verified', 'server-a', now), {target: verified.target, sni: verified.host});
  assert.deepEqual(scanResultSelection({...evidence, source: 'controller', serverId: ''}, 'verified', '', now), {target: verified.target, sni: verified.host});
});

test('inline selection rejects expired, missing, foreign and unverified evidence', () => {
  assert.equal(scanResultSelection(evidence, 'verified', 'server-a', now + 60000), null);
  assert.equal(scanResultSelection(evidence, 'missing', 'server-a', now), null);
  assert.equal(scanResultSelection(evidence, 'verified', 'server-b', now), null);
  assert.equal(scanResultSelection(evidence, 'verified', '', now), null);
  assert.equal(scanResultSelection({...evidence, source: 'controller'}, 'verified', 'server-a', now), null);
  for (const key of ['feasible', 'tls13', 'h2', 'x25519', 'certValid', 'certChainValid', 'host', 'target']) {
    assert.equal(scanResultSelection({...evidence, results: [{...verified, [key]: false}]}, 'verified', 'server-a', now), null, key);
  }
  assert.equal(scanResultSelection({...evidence, results: [{...verified, host: '*.example.com'}]}, 'verified', 'server-a', now), null);
});
const results = [
  { id: 'failed', target: 'failed.example:443', feasible: false, latencyMs: 1 },
  { id: 'slow', target: 'slow.example:443', feasible: true, latencyMs: 160 },
  { id: 'fast', target: 'fast.example:443', feasible: true, latencyMs: 25 },
  { id: 'missing', target: 'missing.example:443', feasible: true, latencyMs: 0 }
];

test('scanner ranks feasible targets before failures and missing timing is not the fastest', () => {
  assert.deepEqual(visibleScanResults(results, false, 'latency').map(row => row.id), ['fast', 'slow', 'missing', 'failed']);
  assert.deepEqual(visibleScanResults(results, true, 'target').map(row => row.id), ['fast', 'missing', 'slow']);
  assert.equal(results[0].id, 'failed');
});

test('import selection excludes failed, already imported and expired evidence', () => {
  const scan = { expiresAt: new Date(now + 60000).toISOString(), results };
  assert.deepEqual(selectedScanResultIds(scan, ['failed', 'fast', 'slow', 'fast', 'unknown'], ['slow'], now), ['fast']);
  assert.deepEqual(selectedScanResultIds(scan, ['fast'], [], now + 60000), []);
  assert.equal(scanExpired(null, now), true);
  assert.equal(scanExpired({ expiresAt: 'invalid' }, now), true);
});

test('pool selection keeps a discovered IP and custom port separate from SNI', () => {
  assert.deepEqual(realityPoolSelection({ target: '[2606:4700:4700::1111]:8443', domain: 'one.one.one.one', port: 8443 }), { target: '[2606:4700:4700::1111]:8443', sni: 'one.one.one.one' });
  assert.deepEqual(realityPoolSelection({ target: '1.1.1.1:443', domain: 'cloudflare-dns.com', serverNames: ['cloudflare-dns.com', 'one.one.one.one'] }), { target: '1.1.1.1:443', sni: 'cloudflare-dns.com' });
  assert.deepEqual(realityPoolSelection({ domain: 'legacy.example' }), { target: 'legacy.example:443', sni: 'legacy.example' });
  assert.deepEqual(realityPoolSelection({ domain: 'port.example', port: 8443 }), { target: 'port.example:8443', sni: 'port.example' });
});
