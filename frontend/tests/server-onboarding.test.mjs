import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function load(relative) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}

const { newServerForm, serverOnboardingFields, serverOnboardingPayload } = await load('../src/lib/server-onboarding.ts');
const { modules } = await load('../src/lib/modules.ts');

test('new Agent submits selected settings and only uses its bundled core', () => {
  const form = { ...newServerForm('agent'), name: ' Node ', address: ' node.example.test ', region: '香港', limit: 1000, globalConfig: '{invalid', connection: 'HTTP', managementMode: 'external-controller', xray_mode: 'external' };
  const payload=serverOnboardingPayload(form);
  assert.equal(payload.region,'香港');assert.equal(payload.limit,1000);
  assert.equal(payload.name,'Node');assert.equal(payload.address,'node.example.test');
  assert.equal(payload.connection,'HTTP');assert.equal(payload.xray_mode,'embedded');
  assert.equal(payload.probeSource,'komari');
  assert.equal(serverOnboardingPayload({...form,komariUUID:' node-a '}).komariUUID,'node-a');
  assert.equal(payload.globalConfig,undefined);assert.equal(payload.managementMode,undefined);
  for(const connection of ['自动','WebSocket','HTTP','轮询']) assert.equal(serverOnboardingPayload({...form,connection}).connection,connection);
  assert.throws(()=>serverOnboardingPayload({...form,connection:'unsupported'}));
  assert.throws(()=>serverOnboardingPayload({...form,agentPort:1.5}));
  assert.equal(serverOnboardingPayload({...form,agentPort:24567}).agentPort,24567);
});

test('new server input needs no mode or management credentials', () => {
  assert.equal(newServerForm('agent').connection, '自动');
  assert.equal(newServerForm('agent').limit, null);
  assert.deepEqual(serverOnboardingFields(modules.servers.fields).filter(field=>field.required).map(field=>field.key), ['name','address']);
  assert.ok(!modules.servers.fields.some(field=>field.key==='xray_mode'));
  assert.deepEqual(modules.servers.fields.find(field => field.key === 'connection').options,['自动','WebSocket','HTTP','轮询']);
});

test('optional unknown budgets stay unknown and invalid numbers are rejected',()=>{
 assert.equal(serverOnboardingPayload({...newServerForm('id'),limit:''}).limit,null);
 for(const limit of [-1,NaN,Infinity,'invalid']) assert.throws(()=>serverOnboardingPayload({...newServerForm('id'),limit}));
});

test('a minimally created server can be edited without supplying an asset budget', () => {
  const requiredNumbers = modules.servers.fields.filter(field => field.type === 'number' && !field.optional);
  assert.deepEqual(requiredNumbers.map(field => field.key), []);
  assert.ok(modules.servers.fields.some(field => field.key === 'globalConfig'));
  assert.ok(modules.servers.fields.some(field => field.key === 'komariUUID'));
  assert.ok(!modules.servers.fields.some(field => ['probeSource','networkQualityTargets'].includes(field.key)));
});
