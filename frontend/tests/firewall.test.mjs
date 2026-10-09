import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {compileModule} from 'svelte/compiler';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const transpile=name=>ts.transpileModule(fs.readFileSync(new URL('../src/lib/'+name,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const helperURL='data:text/javascript;base64,'+Buffer.from(transpile('firewall.ts')).toString('base64');
const {parseFirewallAddresses,prepareFirewallRules,firewallDrafts,firewallPolicyState,checkedFirewallSnapshot}=await import(helperURL);
const compiled=compileModule(transpile('firewall-state.svelte.ts'),{filename:'firewall-state.svelte.js',generate:'client'}).js.code.replace(/(['"])svelte\/internal\/client\1/g,JSON.stringify(pathToFileURL(require.resolve('svelte/internal/client')).href)).replace(/(['"])\.\/firewall\1/g,JSON.stringify(helperURL));
const {createFirewallManager}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const target={id:'inbound-a',name:'客户专用入口',protocol:'tcp',port:8443};
const rule={id:'rule-a',name:'客户出口',protocol:'tcp',port:8443,allowedCidrs:['203.0.113.10/32','2001:db8::10/128']};
const task=(status='queued',id='task-a')=>({id,status});
const observation=(revision=1,extra={})=>({supported:true,backend:'nftables',revision,rules:[rule],applied:true,checkedAt:'2026-10-09T12:00:00Z',...extra});
const snapshot=(extra={})=>({serverId:'server-a',revision:0,rules:[],targets:[target],capable:true,task:null,observed:null,...extra});
const clone=value=>JSON.parse(JSON.stringify(value));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function harness(handler,extra={}){
 let owner='admin-a',visible=true,serial=0;const calls=[],timers=new Map();
 const manager=createFirewallManager({request:async(path,init)=>{calls.push({path,...init});return handler(path,init,calls.length);},identity:()=>owner,visible:()=>visible,schedule:(callback,delay)=>{const id=++serial;timers.set(id,{callback,delay});return id;},cancel:id=>timers.delete(id),...extra});
 return {manager,calls,timers,setIdentity:value=>owner=value,setVisible:value=>visible=value,async poll(){assert.equal(timers.size,1);const [id,next]=timers.entries().next().value;timers.delete(id);assert.equal(next.delay,2000);await next.callback();}};
}
test('source addresses accept IPv4/IPv6 CIDRs and normalize delimiters without accepting hostnames or unsafe syntax',()=>{
 assert.deepEqual(parseFirewallAddresses('203.0.113.10, 2001:DB8::1/128\n203.0.113.10，198.51.100.0/24'),['203.0.113.10','2001:db8::1/128','198.51.100.0/24']);
 assert.deepEqual(parseFirewallAddresses('10.0.0.1/32 fd00::1/128'),['10.0.0.1/32','fd00::1/128']);
 for(const value of ['', 'example.com','999.1.1.1','1.2.3.4/33','::/129','1.2.3.4/-1','1.2.3.4/','1.2.3.4/24/24','fe80::1%eth0','[2001:db8::1]','203.0.113.1;drop','127.000.0.1','2001:::1','::ffff:192.0.2.1/128','0.0.0.0/0','::/0','127.0.0.1','::1','224.0.0.1','ff02::1','169.254.1.1','fe80::1','255.255.255.255','1.2.3.4/1'])assert.throws(()=>parseFirewallAddresses(value),undefined,value);
 assert.throws(()=>parseFirewallAddresses(Array.from({length:129},(_,i)=>`203.0.113.${i}`).join('\n')),/128/);
});
test('only managed targets can be protected, with unique protocol/port pairs and a nonempty allowlist',()=>{
 const drafts=firewallDrafts([rule]);assert.deepEqual(prepareFirewallRules(drafts,[target]),[rule]);
 assert.throws(()=>prepareFirewallRules([{...drafts[0],port:22}],[target]),/已不在/);
 assert.throws(()=>prepareFirewallRules([{...drafts[0],protocol:'udp'}],[target]),/已不在/);
 assert.throws(()=>prepareFirewallRules([{...drafts[0],addresses:''}],[target]),/至少/);
 assert.throws(()=>prepareFirewallRules([...drafts,{...drafts[0],id:'other'}],[target]),/同一个协议与端口/);
 assert.throws(()=>prepareFirewallRules(drafts,[]),/移除/);
 assert.deepEqual(prepareFirewallRules([],[]),[]); // Explicit rule removal is how a port is unprotected.
 assert.throws(()=>prepareFirewallRules(Array.from({length:65},()=>drafts[0]),[target]),/64/);
});
test('applied state requires matching verified policy revision, not task success or a saved policy',()=>{
 assert.equal(firewallPolicyState(snapshot()).label,'未启用');
 assert.notEqual(firewallPolicyState(snapshot({revision:2,rules:[rule],task:task('success'),observed:observation(1)})).tone,'success');
 assert.equal(firewallPolicyState(snapshot({revision:2,rules:[rule],task:task('success'),observed:observation(2)})).tone,'success');
 assert.notEqual(firewallPolicyState(snapshot({revision:2,rules:[rule],observed:observation(2)}),true).tone,'success');
 assert.equal(firewallPolicyState(snapshot({revision:2,rules:[rule],observed:observation(2,{lastError:'规则被其他程序移除'})})).tone,'danger');
 assert.equal(firewallPolicyState(snapshot({revision:3,observed:observation(3,{rules:[]})})).label,'端口限制已解除');
 assert.throws(()=>checkedFirewallSnapshot(snapshot({serverId:'different'}),'server-a'));
 assert.throws(()=>checkedFirewallSnapshot(snapshot({observed:{supported:true,applied:true,revision:1,rules:null}}),'server-a'));
});
test('opening reads saved state only; a save waits for its task and then reads actual applied revision',async()=>{
 let phase='idle';
 const h=harness((path,init)=>{
  if(init.method==='PUT'){assert.deepEqual(JSON.parse(init.body),{revision:0,rules:[rule]});phase='pending';return snapshot({revision:1,rules:[rule],task:task()});}
  if(path.includes('/tasks/')){phase='complete';return {row:task('成功')};}
  return phase==='idle'?snapshot():snapshot({revision:1,rules:[rule],task:task(phase==='complete'?'success':'queued'),observed:phase==='complete'?observation(1):null});
 });
 await h.manager.start('server-a');assert.equal(h.calls.length,1);assert.equal(h.calls[0].method,undefined);assert.equal(h.timers.size,0);
 assert.equal(await h.manager.save([rule],0),true);assert.equal(h.manager.state.snapshot.task.status,'queued');assert.notEqual(firewallPolicyState(h.manager.state.snapshot).tone,'success');
 await h.poll();assert.equal(firewallPolicyState(h.manager.state.snapshot).tone,'success');assert.equal(h.timers.size,0);
 assert.equal(h.calls.filter(call=>call.method==='PUT').length,1);
});
test('terminal task failure remains visible, and an idle page never issues periodic status commands',async()=>{
 const h=harness(path=>path.includes('/tasks/')?{row:{...task('失败'),error:'nftables 不可用'}}:snapshot({revision:1,rules:[rule],task:h.calls.length<3?task():{...task('failed'),error:'nftables 不可用'}}));
 await h.manager.start('server-a');await h.poll();assert.equal(h.timers.size,0);assert.equal(h.manager.state.snapshot.task.error,'nftables 不可用');assert.equal(h.calls.filter(call=>call.method==='POST').length,0);
});
test('polling is bounded, and a manual reload can resume observation without resubmitting a policy',async()=>{
 const h=harness(path=>path.includes('/tasks/')?{row:task('running')}:snapshot({revision:1,rules:[rule],task:task()}),{pollLimit:2});
 await h.manager.start('server-a');await h.poll();await h.poll();assert.equal(h.timers.size,0);assert.match(h.manager.state.notice,/自动检查已暂停/);
 await h.manager.reload();assert.equal(h.timers.size,1);assert.equal(h.calls.filter(call=>call.method==='PUT').length,0);h.manager.stop();
});
test('hidden views cancel queued polls and resume only a read; closing aborts in-flight reads',async()=>{
 const h=harness(()=>snapshot({revision:1,rules:[rule],task:task()}));await h.manager.start('server-a');
 h.setVisible(false);h.manager.pause();assert.equal(h.timers.size,0);assert.equal(h.calls.length,1);
 h.setVisible(true);await h.manager.resume();assert.equal(h.calls.length,2);assert.equal(h.calls[1].method,undefined);h.manager.stop();
 const pending=deferred();let signal;const other=harness((path,init)=>{signal=init.signal;return pending.promise;});
 const reading=other.manager.start('server-a');other.manager.stop();assert.equal(signal.aborted,true);pending.resolve(snapshot());await reading;assert.equal(other.manager.state.snapshot,null);
});
test('late responses cannot display another server or restore data after an account change',async()=>{
 const pending=deferred();const h=harness(path=>path.includes('server-a')?pending.promise:snapshot({serverId:'server-b'}));
 const reading=h.manager.start('server-a');await h.manager.start('server-b');pending.resolve(snapshot());await reading;assert.equal(h.manager.state.snapshot.serverId,'server-b');
 h.setIdentity('');h.manager.syncIdentity();assert.equal(h.manager.state.snapshot,null);assert.equal(h.timers.size,0);
 await h.manager.start('server-b');assert.equal(h.calls.length,2);
});
test('an uncertain mutation blocks duplicate submission until a fresh read verifies what was saved',async()=>{
 let saved=false;const h=harness((path,init)=>{if(init.method==='PUT'){saved=true;throw new Error('连接中断');}return saved?snapshot({revision:1,rules:[rule],task:task()}):snapshot();});
 await h.manager.start('server-a');assert.equal(await h.manager.save([rule],0),false);assert.equal(h.manager.state.verificationPending,true);assert.equal(await h.manager.save([rule],0),false);assert.equal(h.calls.filter(call=>call.method==='PUT').length,1);
 await h.manager.reload();assert.equal(h.manager.state.verificationPending,false);assert.equal(h.manager.state.snapshot.revision,1);h.manager.stop();
});
test('hiding an in-flight save ignores its late receipt, then a visible read verifies execution',async()=>{
 const pending=deferred();let saved=false;const h=harness((path,init)=>{if(init.method==='PUT'){saved=true;return pending.promise;}return saved?snapshot({revision:1,rules:[rule],task:task()}):snapshot();});
 await h.manager.start('server-a');const saving=h.manager.save([rule],0);h.setVisible(false);h.manager.pause();assert.equal(h.manager.state.verificationPending,true);
 pending.resolve(snapshot({revision:1,rules:[rule],task:task()}));assert.equal(await saving,false);assert.equal(h.manager.state.snapshot.revision,0);
 h.setVisible(true);await h.manager.resume();assert.equal(h.manager.state.snapshot.revision,1);h.manager.stop();
});
test('conflicts preserve current state, and a stale editing revision cannot overwrite a newer policy',async()=>{
 const h=harness((path,init)=>{if(init.method==='PUT')throw Object.assign(new Error('策略版本已变化'),{status:409});return snapshot({revision:2,rules:[rule]});});
 await h.manager.start('server-a');assert.equal(await h.manager.save([rule],1),false);assert.equal(h.calls.length,1);
 assert.equal(await h.manager.save([rule],2),false);assert.equal(h.manager.state.snapshot.revision,2);assert.match(h.manager.state.error,/版本已变化/);assert.equal(h.manager.state.verificationPending,false);
});
test('a status refresh can resolve an unknown result without replaying the previous apply task',async()=>{
 let refreshing=false;const h=harness((path,init)=>{if(init.method==='POST')refreshing=true;return snapshot({revision:1,rules:[rule],task:task(refreshing?'queued':'unknown',refreshing?'status-b':'apply-a')});});
 await h.manager.start('server-a');assert.equal(await h.manager.save([rule],1),false);assert.equal(await h.manager.refresh(),true);assert.equal(h.calls.filter(call=>call.method==='POST').length,1);assert.equal(h.calls.filter(call=>call.method==='PUT').length,0);assert.equal(h.manager.state.snapshot.task.id,'status-b');h.manager.stop();
});
test('permission loss during a task poll clears private rules and stops all subsequent polling',async()=>{
 const h=harness(path=>{if(path.includes('/tasks/'))throw Object.assign(new Error('denied'),{status:403});return snapshot({revision:1,rules:[rule],task:task()});});
 await h.manager.start('server-a');await h.poll();assert.equal(h.manager.state.snapshot,null);assert.equal(h.timers.size,0);assert.match(h.manager.state.error,/没有管理/);
});
test('a manual reload supersedes an in-flight task poll and ignores its late status',async()=>{
 const pending=deferred();let reads=0,pollSignal;const h=harness((path,init)=>{
  if(path.includes('/tasks/')){pollSignal=init.signal;return pending.promise;}
  return ++reads===1?snapshot({revision:1,rules:[rule],task:task()}):snapshot({revision:2,rules:[rule],task:task('success','task-b'),observed:observation(2)});
 });
 await h.manager.start('server-a');const polling=h.poll();await h.manager.reload();assert.equal(pollSignal.aborted,true);
 pending.resolve({row:task('running')});await polling;assert.equal(h.manager.state.snapshot.task.id,'task-b');assert.equal(h.manager.state.snapshot.revision,2);assert.equal(h.timers.size,0);
});
