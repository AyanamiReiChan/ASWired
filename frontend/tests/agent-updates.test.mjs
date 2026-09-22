import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/agent-updates.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {agentUpdateBlockReason}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const ready={status:'在线',capabilities:{agent_update:true}};
test('bulk upgrade excludes offline or unsupervised agents even when their probe is online',()=>{
 assert.equal(agentUpdateBlockReason(ready),'');
 assert.match(agentUpdateBlockReason({...ready,status:'离线',probeOnline:true}),/未在线/);
 assert.match(agentUpdateBlockReason({...ready,capabilities:{}}),/迁移服务/);
 assert.match(agentUpdateBlockReason({...ready,capabilities:{agent_update:false}}),/迁移服务/);
});
test('an unfinished rollout cannot be selected for another upgrade',()=>{
 for(const status of ['staged','ready','restarting','healthy'])assert.match(agentUpdateBlockReason({...ready,agentUpdate:{status}}),/尚未完成/);
 for(const status of ['completed','failed','rolled_back'])assert.equal(agentUpdateBlockReason({...ready,agentUpdate:{status}}),'');
});
