import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/snapshot-cache.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {applySnapshot,createSnapshotCache}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('delta keeps unchanged configuration and corrects/deletes old history buckets',()=>{
 const before={config:{name:'unchanged',nested:{obsolete:1}},series:{old:{total:2},current:{total:3}}};
 const after=applySnapshot(before,'a',{base:'a',changes:{config:{nested:{null:null}},series:{old:{total:4},new:{total:1}}},removed:[['series','current'],['config','nested','obsolete']]});
 assert.deepEqual(after,{config:{name:'unchanged',nested:{null:null}},series:{old:{total:4},new:{total:1}}});
 assert.equal(before.series.old.total,2);
 assert.throws(()=>applySnapshot(before,'wrong',{base:'a',changes:{},removed:[]}),/版本/);
 const malicious=JSON.parse('{"__proto__":{"polluted":true}}');
 const result=applySnapshot({},'a',{base:'a',changes:malicious,removed:[]});
 assert.equal({}.polluted,undefined);assert.equal(Object.getPrototypeOf(result),Object.prototype);
});

test('cache sends only the cursor, retries a missing baseline, and isolates caller mutations',async()=>{
 const paths=[];let n=0;
 const cache=createSnapshotCache(async path=>{paths.push(path);n++;return n===1?{cursor:'a',reset:true,data:{rows:{x:{value:1}}}}:n===2?{cursor:'b',base:'a',changes:{rows:{x:{value:2}}},removed:[]}:n===3?{cursor:'c',base:'evicted',changes:{},removed:[]}:{cursor:'d',reset:true,data:{rows:{}}};});
 const first=await cache.read('/state');first.rows.x.value=99;
 assert.equal((await cache.read('/state')).rows.x.value,2);
 assert.deepEqual(await cache.read('/state'),{rows:{}});
 assert.deepEqual(paths,['/state','/state?cursor=a','/state?cursor=b','/state']);
});

test('session clear prevents delayed responses from populating another account cache',async()=>{
 let release;const waiting=new Promise(resolve=>release=resolve);let n=0;const paths=[];
 const cache=createSnapshotCache(async path=>{paths.push(path);if(++n===1){await waiting;return {cursor:'old',reset:true,data:{private:'old'}};}return {cursor:'new',reset:true,data:{private:'new'}};});
 const old=cache.read('/state');cache.clear();assert.deepEqual(await cache.read('/state'),{private:'new'});
 release();await assert.rejects(old,/会话/);await cache.read('/state');assert.equal(paths.at(-1),'/state?cursor=new');
});
