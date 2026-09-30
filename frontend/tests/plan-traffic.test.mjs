import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/plan-traffic.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {bytesPerGB,trafficUsageView,trafficModeLabel,personalTrafficTotal,poolResetLabel}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('existing plans remain individual and use their own quota',()=>{
 const usage=trafficUsageView({used:12,limit:100,poolUsedBytes:80*bytesPerGB,poolLimit:200});
 assert.equal(usage.shared,false);assert.equal(usage.used,12);assert.equal(usage.limit,100);assert.equal(usage.remaining,88);assert.equal(trafficModeLabel({}),'独立额度');
});

test('shared quota uses pool totals while personal contribution and legacy quota remain separate',()=>{
 const row={trafficMode:'shared',used:12,usedBytes:12.125*bytesPerGB,limit:25,poolUsedBytes:90*bytesPerGB,poolLimit:100,poolMemberCount:4};
 const original=structuredClone(row),usage=trafficUsageView(row);
 assert.equal(usage.personalUsed,12.125);assert.equal(usage.used,90);assert.equal(usage.remaining,10);assert.equal(usage.limit,100);assert.equal(usage.percent,90);assert.equal(usage.members,4);
 assert.equal(trafficModeLabel(row),'共享流量池');assert.deepEqual(row,original);
});

test('missing or invalid pool data never falls back to a personal quota or pretends to be zero',()=>{
 for(const missing of [undefined,null,'',false,-1,Infinity,'0x10']){
  const usage=trafficUsageView({trafficMode:'shared',used:0,limit:300,poolUsedBytes:missing,poolLimit:missing});
  assert.equal(usage.used,null);assert.equal(usage.limit,null);assert.equal(usage.remaining,null);assert.equal(usage.percent,null);assert.equal(usage.unlimited,false);
 }
});

test('zero, unlimited and exhausted pools have distinct display values',()=>{
 const empty=trafficUsageView({trafficMode:'shared',poolUsedBytes:0,poolLimit:100,poolMemberCount:0});
 assert.equal(empty.used,0);assert.equal(empty.remaining,100);assert.equal(empty.percent,0);assert.equal(empty.members,0);
 const unlimited=trafficUsageView({trafficMode:'shared',poolUsedBytes:10*bytesPerGB,poolLimit:0});
 assert.equal(unlimited.unlimited,true);assert.equal(unlimited.remaining,null);assert.equal(unlimited.percent,null);
 const exhausted=trafficUsageView({trafficMode:'shared',poolUsedBytes:150*bytesPerGB,poolLimit:100});
 assert.equal(exhausted.used,150);assert.equal(exhausted.remaining,0);assert.equal(exhausted.percent,100);
});

test('member overview sums personal contributions once instead of shared pool totals',()=>{
 const pool={trafficMode:'shared',poolUsedBytes:90*bytesPerGB,poolLimit:100};
 assert.equal(personalTrafficTotal([{...pool,used:3},{...pool,used:4},{used:5}]),12);
 assert.equal(personalTrafficTotal([{...pool,used:3},{...pool}]),null);
 assert.equal(personalTrafficTotal([]),0);
});

test('pool reset label distinguishes an uncreated cycle from a pool without automatic reset',()=>{
 assert.equal(poolResetLabel({}),'共享池周期待建立');
 assert.equal(poolResetLabel({poolCycleStart:'2026-09-01T00:00:00Z'}),'不自动重置');
 assert.equal(poolResetLabel({poolCycleStart:'2026-09-01T00:00:00Z',poolCycleEnd:'bad'}),'重置时间未知');
 assert.match(poolResetLabel({poolCycleStart:'2026-09-01T00:00:00Z',poolCycleEnd:'2026-10-01T00:00:00Z'}),/^统一重置：/);
});
