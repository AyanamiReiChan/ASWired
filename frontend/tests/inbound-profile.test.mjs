import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function load(relative) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const { isManagedRealityInbound, convertToRealityInbound } = await load('../src/lib/inbound-profile.ts');
const { modules } = await load('../src/lib/modules.ts');

test('new managed inbounds use fixed VLESS TCP Reality fields with no other transport settings', () => {
  const fields = modules.inbounds.fields;
  const row = Object.fromEntries(fields.map(field => [field.key, field.value]));
  assert.equal(isManagedRealityInbound(row), true);
  for (const key of ['protocol', 'transport']) assert.equal(fields.find(field => field.key === key).type, 'fixed');
  for (const key of ['certificateFile', 'keyFile', 'path', 'serviceName', 'settings', 'streamSettings']) {
    assert.equal(fields.some(field => field.key === key), false);
  }
});

test('legacy protocols and transports remain unsupported until explicitly converted', () => {
  for (const [protocol, transport] of [['VMess', 'TCP / Reality'], ['Trojan', 'TCP / TLS'], ['VLESS', 'TCP'], ['VLESS', 'XHTTP / Reality'], ['VLESS', 'WebSocket / TLS']]) {
    const legacy = { id: 'legacy', protocol, transport };
    assert.equal(isManagedRealityInbound(legacy), false);
    assert.equal(legacy.protocol, protocol);
    assert.equal(legacy.transport, transport);
  }
  assert.equal(isManagedRealityInbound({ id: 'canonical', protocol: 'vless', transport: 'TCP/REALITY' }), true);
});

test('explicit conversion clears protocol overrides while preserving identity and Reality credentials', () => {
  const legacy = { id: 'existing', name: 'Existing inbound', protocol: 'VMess', transport: 'WebSocket / TLS', network: 'ws', security: 'tls', port: 443, tag: 'existing', serverId: 'server', privateKey: 'fixture-private-key', shortIds: ['01'], settings: { clients: [{ id: 'old' }] }, streamSettings: { network: 'ws', security: 'tls' } };
  const converted = convertToRealityInbound(legacy);
  assert.equal(isManagedRealityInbound(converted), true);
  assert.equal(converted.network, 'tcp');
  assert.equal(converted.security, 'reality');
  assert.deepEqual(converted.settings, {});
  assert.deepEqual(converted.streamSettings, {});
  for (const key of ['id', 'name', 'port', 'tag', 'serverId', 'privateKey', 'shortIds']) assert.deepEqual(converted[key], legacy[key]);
  assert.equal(legacy.protocol, 'VMess');
  assert.equal(legacy.streamSettings.network, 'ws');
});

test('nominal Reality records with hidden legacy overrides still offer explicit conversion', () => {
  const base = { id: 'existing', protocol: 'VLESS', transport: 'TCP / Reality' };
  for (const override of [{ network: 'ws' }, { security: 'tls' }, { settings: { clients: [] } }, { settings: { decryption: 'other' } }, { streamSettings: { realitySettings: {} } }, { streamSettings: { security: 'none' } }, { streamSettings: [] }]) {
    const legacy = { ...base, ...override };
    assert.equal(isManagedRealityInbound(legacy), false);
    assert.equal(isManagedRealityInbound(convertToRealityInbound(legacy)), true);
  }
  assert.equal(isManagedRealityInbound({ ...base, settings: { decryption: 'none' }, streamSettings: { network: 'tcp', security: 'reality', sockopt: { tcpFastOpen: true } } }), true);
});
