import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/xray-config.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {parseConfigDraft,mergeConfigDraft,sectionDraft}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('section edits preserve credentials, routing and unknown fields outside the section',()=>{
 const config={inbounds:[{tag:'in',settings:{privateKey:'keep'}}],outbounds:[{tag:'direct',protocol:'freedom'}],routing:{rules:[{outboundTag:'direct'}]},custom:{nested:['keep']}};
 const result=mergeConfigDraft(config,'[{"tag":"new","protocol":"vless"}]','inbounds');
 assert.equal(result.inbounds[0].tag,'new');assert.deepEqual(result.routing,config.routing);assert.deepEqual(result.outbounds,config.outbounds);assert.deepEqual(result.custom,config.custom);
 assert.equal(config.inbounds[0].settings.privateKey,'keep');
});
test('viewing absent sections does not add empty keys or mark config changed',()=>{
 const config={log:{loglevel:'warning'}};
 for(const section of ['inbounds','outbounds','routing'])assert.deepEqual(mergeConfigDraft(config,sectionDraft(config,section),section),config);
});
test('invalid syntax and wrong section types cannot be merged',()=>{
 for(const text of ['{','null','[]','"text"'])assert.throws(()=>parseConfigDraft(text,'config'));
 for(const section of ['inbounds','outbounds'])for(const text of ['{}','[null]','[1]','[[]]'])assert.throws(()=>parseConfigDraft(text,section));
 assert.throws(()=>mergeConfigDraft({},'[]','routing'));
});
test('edits across tabs and full document remain consistent',()=>{
 let config={inbounds:[{tag:'old'}],routing:{domainStrategy:'AsIs'}};
 config=mergeConfigDraft(config,'[{"tag":"new"}]','inbounds');
 config=mergeConfigDraft(config,'{"domainStrategy":"IPIfNonMatch","rules":[]}','routing');
 const full=parseConfigDraft(sectionDraft(config,'config'),'config');
 assert.equal(full.inbounds[0].tag,'new');assert.equal(full.routing.domainStrategy,'IPIfNonMatch');
 assert.deepEqual(mergeConfigDraft(config,'{"outbounds":[]}','config'),{outbounds:[]});
});
