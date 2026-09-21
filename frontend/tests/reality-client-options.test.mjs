import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function moduleURL(relative, dependencies = {}) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  let js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [path, url] of Object.entries(dependencies)) js = js.replaceAll(`from '${path}'`, `from '${url}'`);
  return 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
}

const profileURL = moduleURL('../src/lib/node-profile.ts');
const { realityClientFormats, realityNodeChoices, realitySpeedtestError, nodeChoices, nodeSpeedtestError } = await import(moduleURL('../src/lib/reality-client-options.ts', { './node-profile': profileURL }));
const publicKey = Buffer.alloc(32, 3).toString('base64url');
const uri = `vless://11111111-2222-3333-4444-555555555555@example.test:443?security=reality&type=tcp&sni=example.test&pbk=${publicKey}`;

test('node choices retain selected legacy and missing references without changing the plan', () => {
  const rows = [
    { id: 'reality', name: 'Supported', protocol: 'VLESS', network: 'tcp', security: 'reality' },
    { id: 'old', name: 'Legacy', protocol: 'VMess', network: 'tcp', security: 'tls' },
    { id: 'other', name: 'Unselected legacy', protocol: 'Trojan', security: 'tls' }
  ];
  const selected = ['reality', 'old', 'deleted'];
  const before = structuredClone({ rows, selected });
  const choices = realityNodeChoices(rows, selected);
  assert.deepEqual(choices.available.map(row => row.id), ['reality']);
  assert.deepEqual(choices.unavailable.map(row => row.id), ['old', 'deleted']);
  assert.equal(choices.unavailable[0].name, 'Legacy');
  assert.equal(choices.unavailable[1].name, 'deleted');
  assert.deepEqual({ rows, selected }, before);
  assert.deepEqual(realityNodeChoices(rows, ['reality']).unavailable, []);
});

test('node choices use the actual URI profile rather than a conflicting label', () => {
  const choices = realityNodeChoices([
    { id: 'valid-uri', protocol: 'Trojan', uri },
    { id: 'bad-uri', protocol: 'VLESS', network: 'tcp', security: 'reality', uri: uri.replace('type=tcp', 'type=ws') },
    { id: 'tls', protocol: 'VLESS', network: 'tcp', security: 'tls' }
  ], []);
  assert.deepEqual(choices.available.map(row => row.id), ['valid-uri']);
});

test('speed tests require actual Clash VLESS TCP Reality fields', () => {
  const node = { type: 'vless', server: 'example.test', port: 443, uuid: '11111111-2222-3333-4444-555555555555', network: 'tcp', tls: true, servername: 'example.test', 'reality-opts': { 'public-key': publicKey } };
  assert.equal(realitySpeedtestError(node), '');
  const defaultNetwork = { ...node };
  delete defaultNetwork.network;
  assert.equal(realitySpeedtestError(defaultNetwork), '');
  for (const patch of [
    { type: 'trojan', protocol: 'vless' },
    { type: 'vmess' },
    { network: 'ws' },
    { network: 'grpc' },
    { tls: false },
    { tls: 'true' },
    { 'reality-opts': undefined },
    { 'reality-opts': [] },
    { 'reality-opts': { 'public-key': '' } },
    { 'reality-opts': { 'public-key': 123 } }
  ]) assert.notEqual(realitySpeedtestError({ ...node, ...patch }), '', JSON.stringify(patch));
  for (const invalid of [null, [], 'vless', 1]) assert.notEqual(realitySpeedtestError(invalid), '');
});

test('multi-protocol subscriptions expose formats with server-side compatibility filtering', () => {
  const codes = realityClientFormats.map(option => option.value);
  for (const supported of ['surge', 'surfboard', 'stash', 'loon']) assert.equal(codes.includes(supported), true);
  for (const supported of ['clash', 'singbox', 'v2ray', 'shadowrocket']) assert.equal(codes.includes(supported), true);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(new Set(realityClientFormats.map(option => option.label)).size, codes.length);
});

test('external protocols are selectable for plans and speedtests', () => {
  const rows = ['VMess','VLESS','Trojan','Shadowsocks','Hysteria','Hysteria2','SOCKS5','AnyTLS','Snell','TUIC','WireGuard'].map((protocol,i)=>({id:String(i),protocol}));
  assert.equal(nodeChoices(rows,[]).available.length,rows.length);
  assert.deepEqual(nodeChoices(rows,['missing']).unavailable.map(row=>row.id),['missing']);
  for (const row of rows) assert.equal(nodeSpeedtestError({type:row.protocol,server:'example.test',port:443}),'');
  for (const row of [{type:'unknown',server:'example.test',port:443},{type:'trojan',port:0},null]) assert.notEqual(nodeSpeedtestError(row),'');
});
