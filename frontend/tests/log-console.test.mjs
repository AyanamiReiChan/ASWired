import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/log-console.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {consoleEntries,filterLogs,eventLevel,logFields}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('classifies real audit/task sources and links scheduled results without duplicating entries',()=>{
 const entries=consoleEntries({audit:[{id:'security',action:'identity.passkey.login',created:'2026-09-20T01:00:00Z'},{id:'schedule',action:'schedule.run',actor:'scheduler',resource:'s',created:'2026-09-20T01:01:00Z',detail:{taskId:'t',status:'failed'}},{id:'op',action:'agent.command.queued',detail:{taskId:'agent'}}],tasks:[{id:'t',type:'backup.create',status:'失败',created:'2026-09-20T01:00:00Z',updated:'2026-09-20T01:01:00Z'},{id:'agent',target:'server',type:'core.status',status:'成功'}],servers:[{id:'server',name:'Tokyo'}]});
 assert.equal(entries.length,5);
 assert.equal(entries.find(x=>x.recordId==='security').category,'security');
 assert.equal(entries.find(x=>x.recordId==='t').category,'schedule');
 assert.equal(entries.find(x=>x.recordId==='agent').source,'Tokyo');
 const trace=filterLogs(entries,{category:'all',level:'',source:'',query:'',taskId:'agent'});
 assert.equal(trace.length,2);assert(trace.every(x=>x.taskId==='agent'));
});
test('preserves explicit levels and distinguishes unresolved results from failures',()=>{
 assert.equal(eventLevel({level:'fatal'}),'FATAL');assert.equal(eventLevel({status:'结果未明'}),'WARN');
 assert.equal(eventLevel({status:'失败'}),'ERROR');assert.equal(eventLevel({action:'auth.login.failed'}),'WARN');
 assert.equal(eventLevel({result:'已记录'}),'INFO');
});
test('does not copy task configuration or credentials into search/export fields',()=>{
 const entries=consoleEntries({tasks:[{id:'t',type:'core.config.get',status:'成功',result:{config:{password:'task-secret'}}}],audit:[{id:'a',detail:{nested:{privateKey:'nested-secret'},apiToken:'token-secret',config:{raw:'config-secret'},count:2}}]});
 const json=JSON.stringify(entries);
 for(const secret of ['task-secret','nested-secret','token-secret','config-secret'])assert(!json.includes(secret));
 assert.equal(logFields({count:2}).count,2);
});
test('filters by category, severity, source and multiple terms without fabricating data',()=>{
 const entries=consoleEntries({tasks:[{id:'t',target:'s',type:'core.restart',status:'失败',error:'connection timeout'}],servers:[{id:'s',name:'Tokyo'}]});
 assert.equal(filterLogs(entries,{category:'agent',level:'ERROR',source:'Tokyo',query:'restart timeout'}).length,1);
 assert.equal(filterLogs(entries,{category:'agent',level:'INFO',source:'',query:''}).length,0);
 assert.deepEqual(consoleEntries({}),[]);
});
