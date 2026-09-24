import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {compileModule} from 'svelte/compiler';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url);
const source=ts.transpileModule(fs.readFileSync(new URL('../src/lib/upgrade-backups.svelte.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const compiled=compileModule(source,{filename:'upgrade-backups.svelte.js',generate:'client'}).js.code.replace(/(['"])svelte\/internal\/client\1/g,JSON.stringify(pathToFileURL(require.resolve('svelte/internal/client')).href));
const {createUpgradeBackups,backupOperationPending}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const base='/api/system/upgrade-backups';
const item={id:'20260925T010203Z',createdAt:'2026-09-25T01:02:03Z',previousVersion:'v1.0.8',sizeBytes:12345,files:[{name:'data.tar.gz',sizeBytes:12345}],deletable:true};
const status=(phase='idle',extra={})=>({supported:true,phase,items:[{...item}],totalSizeBytes:item.sizeBytes,...extra});
const snapshot=manager=>JSON.parse(JSON.stringify(manager.state));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function harness(handler,overrides={}){
 let identity='admin-a',visible=true,updating=false,serial=0;
 const calls=[],timers=new Map();
 const manager=createUpgradeBackups({
  request:async(path,init)=>{calls.push({path,...init});return handler(path,init,calls.length);},
  identity:()=>identity,visible:()=>visible,updating:()=>updating,
  schedule:(callback,delay)=>{const id=++serial;timers.set(id,{callback,delay});return id;},cancel:id=>timers.delete(id),...overrides,
 });
 return {manager,calls,timers,setIdentity:value=>identity=value,setVisible:value=>visible=value,setUpdating:value=>updating=value,
  async poll(){assert.equal(timers.size,1);const [id,next]=timers.entries().next().value;timers.delete(id);await next.callback();},
 };
}

test('entry reads once, queues one scan, polls only pending work and stops after the verified inventory',async()=>{
 const responses=[status(),status('queued',{requestId:'scan-1',operation:'refresh'}),status('scanning',{requestId:'scan-1'}),status('completed',{requestId:'scan-1',items:[],totalSizeBytes:0})];
 const h=harness(()=>responses.shift());
 await h.manager.start();
 assert.deepEqual(h.calls.map(call=>[call.path,call.method]),[[base,undefined],[base+'/refresh','POST']]);
 assert.equal(h.calls[1].body,undefined);
 assert.equal(h.manager.state.status.phase,'queued');
 assert.deepEqual(snapshot(h.manager).status.items,[item]);
 await h.poll();assert.equal(h.manager.state.status.phase,'scanning');
 await h.poll();assert.deepEqual(snapshot(h.manager).status.items,[]);
 assert.equal(h.timers.size,0);
 await h.manager.start();assert.equal(h.calls.length,4);
});

test('entering an existing deletion observes it without queuing another scan',async()=>{
 const h=harness(()=>status('deleting',{requestId:'other-admin',operation:'delete',backupId:item.id}));
 await h.manager.start();
 assert.equal(h.calls.length,1);assert.equal(h.timers.size,1);
 assert.equal(h.manager.canRemove(item.id),false);
 await h.manager.refresh();
 assert.equal(h.calls.at(-1).method,undefined);assert.equal(h.calls.length,2);
 h.manager.stop();assert.equal(h.timers.size,0);
});

test('delete requires the exact ID and keeps the item until a GET verifies completion',async()=>{
 let phase='entry';
 const h=harness((path,init)=>{
  if(init.method==='DELETE'){
   assert.equal(path,base+'/'+encodeURIComponent(item.id));assert.deepEqual(JSON.parse(init.body),{confirm:item.id});phase='delete';
   // Even an overly optimistic 202 receipt cannot prove deletion.
   return status('completed',{requestId:'delete-1',operation:'delete',items:[],totalSizeBytes:0});
  }
  if(init.method==='POST')return status('queued',{requestId:'scan-1'});
  return phase==='delete'?status('completed',{requestId:'delete-1',operation:'delete',items:[],totalSizeBytes:0}):status('completed');
 });
 await h.manager.start();await h.poll();
 assert.equal(await h.manager.remove(item.id,'delete'),false);
 assert.equal(await h.manager.remove(item.id,item.id+' '),false);
 assert.equal(h.calls.length,3);
 assert.equal(await h.manager.remove(item.id,item.id),true);
 assert.equal(h.manager.state.status.phase,'queued');
 assert.equal(backupOperationPending(h.manager.state.status),true);
 assert.deepEqual(snapshot(h.manager).status.items,[item]);
 assert.equal(h.manager.canRemove(item.id),false);
 await h.poll();assert.equal(h.manager.state.status.phase,'completed');
 assert.deepEqual(snapshot(h.manager).status.items,[]);assert.equal(h.timers.size,0);
});

test('failed worker deletion retains the returned inventory and reports failure without retrying the delete',async()=>{
 let deleting=false;
 const h=harness((path,init)=>{
  if(init.method==='DELETE'){deleting=true;return status('queued',{requestId:'delete-1'});}
  if(init.method==='POST')return status('queued');
  return deleting?status('failed',{requestId:'delete-1',operation:'delete',message:'备份已被正在进行的升级占用',items:[{...item,deletable:false,reason:'正在使用'}]}):status('completed');
 });
 await h.manager.start();await h.poll();await h.manager.remove(item.id,item.id);await h.poll();
 assert.equal(h.manager.state.status.phase,'failed');
 assert.match(h.manager.state.status.message,/升级占用/);
 assert.equal(h.manager.canRemove(item.id),false);assert.equal(h.timers.size,0);
 assert.equal(h.calls.filter(call=>call.method==='DELETE').length,1);
});

test('a server conflict never fabricates deletion or automatically retries a destructive request',async()=>{
 const h=harness((path,init)=>{if(init.method==='DELETE')throw Object.assign(new Error('已有备份任务正在执行'),{status:409});return init.method==='POST'?status('queued'):status('completed');});
 await h.manager.start();await h.poll();
 assert.equal(await h.manager.remove(item.id,item.id),false);
 assert.match(h.manager.state.error,/已有备份任务/);
 assert.deepEqual(snapshot(h.manager).status.items,[item]);assert.equal(h.timers.size,0);
});

test('upgrades, protected items and absent IDs cannot submit a delete',async()=>{
 const protectedItem={...item,id:'protected',deletable:false,reason:'最近一次升级所需的备份'};
 const h=harness((path,init)=>status(init.method==='POST'?'queued':'completed',{items:[item,protectedItem]}));
 await h.manager.start();await h.poll();const before=h.calls.length;
 assert.equal(await h.manager.remove('protected','protected'),false);
 assert.equal(await h.manager.remove('missing','missing'),false);
 h.setUpdating(true);assert.equal(h.manager.canRemove(item.id),false);
 assert.equal(await h.manager.remove(item.id,item.id),false);
 assert.match(h.manager.state.error,/系统正在升级/);assert.equal(h.calls.length,before);
});

test('unsupported installations preserve their supplied list while disabling scan and deletion',async()=>{
 const h=harness(()=>status('idle',{supported:false,reason:'独立部署没有升级备份服务'}));
 await h.manager.start();assert.equal(h.calls.length,1);assert.equal(h.timers.size,0);
 assert.deepEqual(snapshot(h.manager).status.items,[item]);
 assert.equal(h.manager.canRemove(item.id),false);
 assert.equal(await h.manager.refresh(),false);assert.equal(h.calls.length,2);assert.equal(h.calls.at(-1).method,undefined);
});

test('members make no requests and revoking administrator access removes cached backup data',async()=>{
 const h=harness((path,init)=>status(init.method==='POST'?'queued':'completed'));
 h.setIdentity('');await h.manager.start();assert.equal(h.calls.length,0);assert.match(h.manager.state.error,/只有管理员/);
 h.setIdentity('admin-a');await h.manager.start();await h.poll();
 h.setIdentity('');h.manager.syncIdentity();
 assert.equal(h.manager.state.status,null);assert.equal(h.timers.size,0);
 assert.equal(await h.manager.remove(item.id,item.id),false);
 assert.equal(h.calls.length,3);
});

for(const statusCode of [401,403])test(`a ${statusCode} during polling clears the list and stops further requests`,async()=>{
 const h=harness((path,init,count)=>{if(count===3)throw Object.assign(new Error('denied'),{status:statusCode});return status(count===2?'queued':'idle');});
 await h.manager.start();await h.poll();
 assert.equal(h.manager.state.status,null);assert.equal(h.timers.size,0);
 assert.match(h.manager.state.error,statusCode===403?/没有管理/:/登录已过期/);
});

test('temporary polling failure retains pending status and a visible retry can finish the operation',async()=>{
 const h=harness((path,init,count)=>{if(count===3)throw new Error('无法连接主控');return status(count===2?'queued':count===4?'completed':'idle');});
 await h.manager.start();await h.poll();
 assert.match(h.manager.state.error,/无法连接/);assert.equal(h.manager.state.status.phase,'queued');assert.equal(h.timers.size,1);
 await h.poll();assert.equal(h.manager.state.error,'');assert.equal(h.timers.size,0);
});

test('hidden pending views send no requests and resume checks status without a new scan',async()=>{
 const h=harness((path,init,count)=>status(count===2?'queued':count===3?'completed':'idle'));
 await h.manager.start();h.setVisible(false);await h.poll();assert.equal(h.calls.length,2);assert.equal(h.timers.size,1);
 h.setVisible(true);await h.manager.resume();assert.equal(h.calls.length,3);assert.equal(h.calls[2].method,undefined);assert.equal(h.timers.size,0);
});

for(const ending of ['unmount','account change'])test(`a delayed entry response cannot restore private data after ${ending}`,async()=>{
 const pending=deferred();let signal;
 const h=harness((path,init)=>{signal=init.signal;return pending.promise;});
 const loading=h.manager.start();
 if(ending==='unmount')h.manager.stop();else{h.setIdentity('admin-b');h.manager.syncIdentity();}
 assert.equal(signal.aborted,true);pending.resolve(status());await loading;
 assert.equal(h.manager.state.status,null);assert.equal(h.calls.length,1);assert.equal(h.timers.size,0);
});

test('a late mutation receipt cannot overwrite another account or resume polling',async()=>{
 const pending=deferred();let deleting=false;
 const h=harness((path,init)=>{if(init.method==='DELETE'){deleting=true;return pending.promise;}return status(init.method==='POST'?'queued':'completed');});
 await h.manager.start();await h.poll();
 const removing=h.manager.remove(item.id,item.id);assert.equal(deleting,true);
 h.setIdentity('admin-b');h.manager.syncIdentity();
 pending.resolve(status('queued'));assert.equal(await removing,false);
 assert.equal(h.manager.state.status,null);assert.equal(h.timers.size,0);
});

test('malformed inventory is rejected and cannot authorize a deletion',async()=>{
 const h=harness(()=>status('completed',{items:[{...item,files:null}]}));
 await h.manager.start();assert.equal(h.calls.length,1);
 assert.equal(h.manager.state.status,null);assert.match(h.manager.state.error,/清单无效/);
 assert.equal(h.manager.canRemove(item.id),false);assert.equal(h.timers.size,0);
});

test('an uncertain delete response requires a status read before another mutation',async()=>{
 let attempted=false;
 const h=harness((path,init)=>{
  if(init.method==='DELETE'){attempted=true;throw new Error('连接已中断');}
  if(init.method==='POST')return status('queued');
  return attempted?status('deleting',{requestId:'accepted-with-lost-response',operation:'delete'}):status('completed');
 });
 await h.manager.start();await h.poll();
 assert.equal(await h.manager.remove(item.id,item.id),false);
 assert.equal(h.manager.state.needsVerification,true);assert.equal(h.manager.canRemove(item.id),false);
 assert.match(h.manager.state.error,/请求结果尚未确认/);assert.equal(h.timers.size,0);
 await h.manager.refresh();
 assert.equal(h.calls.at(-1).method,undefined);assert.equal(h.manager.state.status.phase,'deleting');
 assert.equal(h.manager.state.needsVerification,false);assert.equal(h.timers.size,1);
 assert.equal(h.calls.filter(call=>call.method==='DELETE').length,1);
});

test('truncated inventories retain server counts and never fabricate total disk usage',async()=>{
 const h=harness((path,init)=>status(init.method==='POST'?'queued':'completed',{truncated:true,remainingCount:27,totalSizeBytes:12345}));
 await h.manager.start();await h.poll();
 assert.equal(h.manager.state.status.truncated,true);assert.equal(h.manager.state.status.remainingCount,27);assert.equal(h.manager.state.status.totalSizeBytes,12345);
});
