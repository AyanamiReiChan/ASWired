import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function load(relative) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const { realityNodeURIError, isRealityNodeProfile, nodeURIError } = await load('../src/lib/node-profile.ts');
const { modules } = await load('../src/lib/modules.ts');
const uri = 'vless://01234567-89ab-cdef-0123-456789abcdef@node.example:443?security=reality&type=tcp&sni=target.example&pbk=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE&sid=12ab&flow=xtls-rprx-vision';

test('external node form derives its protocol from URI and managed outbounds keep their profile', () => {
  assert.ok(modules.nodes.fields.some(field => field.key === 'uri'));
  for (const key of ['protocol', 'network', 'security']) assert.equal(modules.nodes.fields.some(field => field.key === key && field.type === 'fixed'), false);
  const outbound = modules.outbounds.fields.find(field => field.key === 'protocol');
  assert.deepEqual(outbound.options, ['VLESS', 'Freedom', 'Blackhole']);
  assert.equal(outbound.value, 'VLESS');
});

test('external URI validation allows standard aliases and implicit default ports', () => {
  for (const value of ['https://user:pass@example.test:443','http://user:pass@example.test','hy2://pass@example.test','anytls://pass@example.test','ss://YWVzLTEyOC1nY206cGFzcw@example.test:8388','socks://user:pass@example.test:1080']) assert.equal(nodeURIError(value),'');
  for (const value of ['ftp://example.test:21','trojan://pass@example.test','not a URI']) assert.notEqual(nodeURIError(value),'');
});

test('valid Reality node links accept TCP aliases, IPv6 and empty short IDs', () => {
  for (const value of [uri, uri.replace('type=tcp&', ''), uri.replace('type=tcp', 'type=raw'), uri.replace('node.example', '[2001:db8::1]'), uri.replace('sid=12ab', 'sid=')]) assert.equal(realityNodeURIError(value), '');
});

test('other actual protocols or transports cannot masquerade under a VLESS label', () => {
  for (const value of [uri.replace('vless:', 'trojan:'), uri.replace('type=tcp', 'type=ws'), uri.replace('type=tcp', 'type=grpc'), uri.replace('security=reality', 'security=tls'), uri.replace('security=reality&', ''), uri + '&type=ws', uri + '&security=tls']) {
    assert.notEqual(realityNodeURIError(value), '');
    assert.equal(isRealityNodeProfile({ id: 'old', protocol: 'VLESS', network: 'tcp', security: 'reality', uri: value }), false);
  }
});

test('missing or malformed connection credentials have actionable errors', () => {
  for (const value of [uri.replace(':443', ''), uri.replace('01234567-89ab-cdef-0123-456789abcdef', 'invalid'), uri.replace('sni=target.example', 'sni='), uri.replace('pbk=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAE', 'pbk=bad'), uri.replace('sid=12ab', 'sid=123'), uri.replace('flow=xtls-rprx-vision', 'flow=other'), uri + '&encryption=aes']) assert.notEqual(realityNodeURIError(value), '');
});

test('URI-less structured nodes remain editable and unsupported records are not rewritten', () => {
  assert.equal(isRealityNodeProfile({ id: 'structured', protocol: 'VLESS', network: 'tcp', security: 'reality' }), true);
  const legacy = { id: 'old', protocol: 'VMess', network: 'ws', security: 'tls' };
  assert.equal(isRealityNodeProfile(legacy), false);
  assert.deepEqual(legacy, { id: 'old', protocol: 'VMess', network: 'ws', security: 'tls' });
});

test('managed node choices recognize the canonical inbound transport without masking conflicts', () => {
  const node = { id: 'managed', managedInbound: true, protocol: 'VLESS', transport: 'TCP / Reality' };
  assert.equal(isRealityNodeProfile(node), true);
  for (const override of [{ network: 'ws' }, { security: 'tls' }, { transport: 'XHTTP / Reality' }, { managementError: '旧协议不受支持' }]) assert.equal(isRealityNodeProfile({ ...node, ...override }), false);
});
