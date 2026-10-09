import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/member-subscriptions.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {availableMemberPlans,newMemberSubscription,mergedSubscriptionView,sameSubscriptionSelection,mergedSubscriptionPayload,mergedSubscriptionURL,mergedSubscriptionAvailability}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const plans=[{id:'ordinary',name:'普通套餐',status:'启用',limit:300},{id:'chain',name:'AAITR 链式代理',status:'启用',limit:300},{id:'retired',name:'停用套餐',status:'停用'}];
const entries=[{id:'ordinary-instance',name:'Alice · 普通套餐',planId:'ordinary',plan:'普通套餐',active:true,status:'启用',expires:''},{id:'chain-instance',name:'Alice · AAITR 链式代理',planId:'chain',plan:'AAITR 链式代理',active:false,status:'停用',expires:''}];

test('adding another plan creates a new instance and leaves prior credentials, usage and expiry intact',()=>{
 const existing=[{id:'ordinary-instance',planId:'ordinary',token:'keep-token',used:27,limit:300,expires:'2026-12-01'}];
 const before=structuredClone(existing);
 assert.deepEqual(availableMemberPlans(plans,existing).map(plan=>plan.id),['chain']);
 const added=newMemberSubscription({id:'alice',username:'Alice'},plans[1],existing,'chain-instance');
 assert.deepEqual(added,{id:'chain-instance',name:'Alice · AAITR 链式代理',memberId:'alice',planId:'chain',limit:300,expires:'',status:'启用'});
 assert.deepEqual(existing,before);
 assert.throws(()=>newMemberSubscription({id:'alice'},plans[0],existing,'new-id'),/已绑定/);
 assert.throws(()=>newMemberSubscription({id:'alice'},plans[1],existing,'ordinary-instance'),/新的套餐实例/);
 assert.throws(()=>newMemberSubscription({id:'alice'},plans[2],existing,'new-id'),/已停用/);
});

test('all plans, an explicit subset and an empty selection have different saved meanings',()=>{
 const base={enabled:true,subscriptions:entries,url:'https://example.test/api/merged-subscribe?token=abc'};
 assert.equal(mergedSubscriptionView(base).subscriptionIds,null);
 assert.deepEqual(mergedSubscriptionView({...base,subscriptionIds:[]}).subscriptionIds,[]);
 assert.deepEqual(mergedSubscriptionView({...base,subscriptionIds:['chain-instance']}).subscriptionIds,['chain-instance']);
 assert.equal(sameSubscriptionSelection(null,[]),false);
 assert.equal(sameSubscriptionSelection(['a','b'],['b','a']),true);
 assert.equal(sameSubscriptionSelection(['a'],['a','b']),false);
 assert.deepEqual(mergedSubscriptionPayload(true,null,entries),{enabled:true,rotate:false,subscriptionIds:null});
 assert.deepEqual(mergedSubscriptionPayload(true,['chain-instance'],entries,true),{enabled:true,rotate:true,subscriptionIds:['chain-instance']});
 assert.deepEqual(mergedSubscriptionPayload(false,[],entries),{enabled:false,rotate:false,subscriptionIds:[]});
 assert.throws(()=>mergedSubscriptionPayload(true,[],entries),/至少选择/);
});

test('a deleted selection remains explicit and cannot silently expand to every available plan',()=>{
 const saved=mergedSubscriptionView({enabled:true,subscriptions:entries,subscriptionIds:['deleted-instance']});
 assert.deepEqual(saved.subscriptionIds,['deleted-instance']);
 assert.throws(()=>mergedSubscriptionPayload(true,saved.subscriptionIds,entries),/已不可用/);
 assert.deepEqual(mergedSubscriptionPayload(true,['ordinary-instance'],entries).subscriptionIds,['ordinary-instance']);
 for(const invalid of [undefined,{}, {enabled:true},{enabled:true,subscriptions:null},{enabled:true,subscriptions:entries,subscriptionIds:'all'},{enabled:true,subscriptions:[...entries,entries[0]]}])assert.throws(()=>mergedSubscriptionView(invalid));
});

test('a deleted selection never prevents disabling or rotating its saved link without widening the subset',()=>{
 const selection=['ordinary-instance','deleted-instance'];
 const disabled=mergedSubscriptionPayload(false,selection,entries,false,selection);
 assert.deepEqual(disabled,{enabled:false,rotate:false});
 assert.equal(Object.hasOwn(disabled,'subscriptionIds'),false);
 const rotated=mergedSubscriptionPayload(true,selection,entries,true,[...selection].reverse());
 assert.deepEqual(rotated,{enabled:true,rotate:true});
 assert.equal(Object.hasOwn(rotated,'subscriptionIds'),false);
 assert.throws(()=>mergedSubscriptionPayload(true,selection,entries,false,selection),/已不可用/);
 assert.throws(()=>mergedSubscriptionPayload(false,['new-deleted-instance'],entries,false,selection),/已不可用/);
 assert.deepEqual(mergedSubscriptionPayload(false,['ordinary-instance'],entries,false,selection),{enabled:false,rotate:false,subscriptionIds:['ordinary-instance']});
});

test('an enabled instance with an unavailable plan or quota never gets an enabled or green badge',()=>{
 for(const reason of ['套餐已到期','共享池额度已用尽','套餐已停用']){
  assert.deepEqual(mergedSubscriptionAvailability({...entries[0],active:false,status:'启用',unavailableReason:reason}),{value:'当前不可用',kind:'warning'});
 }
 assert.deepEqual(mergedSubscriptionAvailability(entries[0]),{value:'可用',kind:'success'});
});

test('merged links preserve the token and use one format parameter for both public and relative URLs',()=>{
 const raw='https://example.test/api/merged-subscribe?token=abc%2B123&format=clash';
 const singbox=new URL(mergedSubscriptionURL(raw,'singbox'));
 assert.equal(singbox.searchParams.get('token'),'abc+123');
 assert.deepEqual(singbox.searchParams.getAll('format'),['singbox']);
 assert.equal(mergedSubscriptionURL('/api/merged-subscribe?token=abc','clash','https://example.test'),'https://example.test/api/merged-subscribe?token=abc&format=clash');
 for(const unsafe of ['javascript:alert(1)','data:text/plain,unsafe','//unexpected.test/path','https://user:password@example.test/path','broken'])assert.equal(mergedSubscriptionURL(unsafe,'clash','https://example.test'),'');
});
