import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/member-traffic.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {memberTrafficView,createMemberTrafficLoader}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

const usage=(total,raw=total)=>({totalBytes:total,uploadBytes:total/4,downloadBytes:total*3/4,rawTotalBytes:raw,rawUploadBytes:raw/4,rawDownloadBytes:raw*3/4,gap:false});
const node=(id,total,raw=total)=>({id,kind:'inbound',nodeId:id,inboundId:id,nodeName:id,serverId:'server',serverName:'测试服务器',share:999,...usage(total,raw)});
function fixture(memberId='alice',range='cycle'){
 return {memberId,range,generatedAt:'2026-10-09T12:00:00Z',from:'2026-10-01T00:00:00Z',to:'2026-10-09T12:00:00Z',endExclusive:true,scope:range==='cycle'?'current-subscription-cycles':'owner-history',
  windows:range==='cycle'?[{subscriptionId:'alice-plan',subscriptionName:'共享套餐 · Alice',from:'2026-10-01T00:00:00Z',to:'2026-10-09T12:00:00Z'}]:[],
  totals:usage(100,60),rows:[node('日本',25,35),node('香港',75,25)],hasUnmappedTraffic:false};
}
const pending=()=>{let resolve,reject;const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail;});return {promise,resolve,reject};};

test('distribution ranks personal billed usage while keeping raw transfer and pool consumption separate',()=>{
 const data=fixture();data.poolUsedBytes=9000;data.rows[0].gap=true;
 const original=structuredClone(data),view=memberTrafficView(data,'alice','cycle');
 assert.equal(view.totals.totalBytes,100);assert.equal(view.totals.rawTotalBytes,60);
 assert.deepEqual(view.rows.map(row=>[row.nodeName,row.share,row.rawTotalBytes]),[['香港',75,25],['日本',25,35]]);
 assert.equal(view.rows[1].gap,true);assert.deepEqual(data,original);
});

test('zero billed traffic can still show real raw traffic and historical unresolved groups',()=>{
 const data=fixture();data.totals=usage(0,600);data.rows=[{...node('old',0,600),kind:'historical',nodeId:'',inboundId:'',nodeName:'历史或无法细分的流量'}];data.hasUnmappedTraffic=true;
 const view=memberTrafficView(data,'alice','cycle');
 assert.equal(view.rows[0].share,0);assert.equal(view.rows[0].rawTotalBytes,600);assert.equal(view.hasUnmappedTraffic,true);
 data.rows=[];data.totals=usage(0);data.windows=[];data.from=null;
 assert.deepEqual(memberTrafficView(data,'alice','cycle').rows,[]);
});

test('missing or malformed statistics never become an empty or zero result',()=>{
 for(const value of [undefined,null,'0',-1,Infinity,NaN]){
  const data=fixture();data.totals.totalBytes=value;
  assert.throws(()=>memberTrafficView(data,'alice','cycle'),/不完整/);
 }
 for(const change of [data=>delete data.rows,data=>data.rows.push({...data.rows[0]}),data=>data.generatedAt='invalid',data=>data.rows[0].rawDownloadBytes=-1]){
  const data=fixture();change(data);assert.throws(()=>memberTrafficView(data,'alice','cycle'),/不完整/);
 }
 assert.throws(()=>memberTrafficView(fixture(),'bob','cycle'),/不完整/);
 assert.throws(()=>memberTrafficView(fixture(),'alice','7d'),/不完整/);
 const wrongScope=fixture('alice','7d');wrongScope.scope='current-subscription-cycles';
 assert.throws(()=>memberTrafficView(wrongScope,'alice','7d'),/不完整/);
});

test('changing users and ranges cancels the previous request and ignores its late success',async()=>{
 const requests=[],states=[];
 const loader=createMemberTrafficLoader((path,init)=>{const waiting=pending();requests.push({path,init,...waiting});return waiting.promise;},state=>states.push(state));
 const alice=loader.load('alice','cycle');
 const bob=loader.load('bob/id','7d');
 assert.equal(requests[0].init.signal.aborted,true);
 assert.equal(requests[1].path,'/api/members/bob%2Fid/traffic?range=7d');
 assert.equal(states.at(-1).data,null);
 requests[1].resolve(fixture('bob/id','7d'));await bob;
 assert.equal(states.at(-1).data.memberId,'bob/id');
 const count=states.length;requests[0].resolve(fixture());await alice;
 assert.equal(states.length,count);assert.equal(states.at(-1).data.range,'7d');
});

test('closing or destroying the dialog suppresses late responses and errors',async()=>{
 for(const reject of [false,true]){
  const waiting=pending(),states=[];let signal;
  const loader=createMemberTrafficLoader((_path,init)=>{signal=init.signal;return waiting.promise;},state=>states.push(state));
  const task=loader.load('alice','cycle');loader.cancel();assert.equal(signal.aborted,true);
  if(reject)waiting.reject(new Error('old error'));else waiting.resolve(fixture());
  await task;assert.equal(states.length,1);
 }
});

test('an API failure is visible and retry can recover without stale data',async()=>{
 let calls=0;const states=[];
 const loader=createMemberTrafficLoader(async()=>{if(++calls===1)throw new Error('采样查询暂不可用');return fixture();},state=>states.push(state));
 await loader.load('alice','cycle');assert.deepEqual(states.at(-1),{loading:false,data:null,error:'采样查询暂不可用'});
 await loader.load('alice','cycle');assert.equal(states.at(-1).error,'');assert.equal(states.at(-1).data.totals.totalBytes,100);
});
