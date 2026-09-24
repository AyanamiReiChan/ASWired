import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/limits-view.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const view=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('zero samples, unlimited configuration and quota stops retain distinct meanings',()=>{
 assert.equal(view.rateLabel(0.001),'0.001 Mbps');assert.equal(view.rateLabel(0),'0 Mbps');assert.equal(view.rateLabel(0,true),'不限');
 assert.equal(view.triggerResult({type:'quota_triggered',limitMbps:0}),'停用该套餐凭据');
 assert.equal(view.triggerResult({type:'quota_triggered',limitMbps:5}),'5 Mbps');
 assert.equal(view.ruleResult({kind:'quota',quotaMode:'stop',limitMbps:20}),'停用该套餐凭据');
 for(const bad of [undefined,null,'',false,'0x10',-1,Infinity])assert.equal(view.rateLabel(bad),'未知');
});
test('history uses trigger snapshots and explicitly identifies absent historical thresholds',()=>{
 const row={type:'triggered',reason:'sustained',ruleId:'global/balanced-long'};
 assert.equal(view.triggerCondition(row),'持续超速 · 历史记录未保存阈值');
 assert.equal(view.triggerCondition({...row,rule:{type:'sustained',thresholdMbps:81,durationSeconds:120}}),'下载 ≥ 81 Mbps，持续 2 分钟');
 assert.equal(view.triggerCondition({...row,type:'quota_triggered'}),'套餐流量额度用尽');
});
test('rules distinguish trigger window, sample hits, penalty duration and explicit unlimited overrides',()=>{
 const rule={id:'member:1/custom',kind:'behavior',type:'burst',thresholdMbps:100,windowSeconds:60,hits:5,penaltySeconds:600,limitMbps:30};
 assert.equal(view.ruleCondition(rule),'1 分钟内，下载 ≥ 100 Mbps 的采样累计 5 次');
 assert.equal(view.rulePeriod(rule),'10 分钟');assert.equal(view.ruleResult(rule),'30 Mbps');
 assert.equal(view.ruleResult({kind:'speed',limitMbps:0}),'不限');
 assert.equal(view.ruleCondition({kind:'speed',resourceId:'n1',resourceName:'东京'}),'仅限 东京');
});
test('missing quota deadlines do not display epoch and filters find named users and rules',()=>{
 for(const value of [undefined,'','bad','1970-01-01T00:00:00Z'])assert.equal(view.timeLabel(value),'—');
 assert.ok(view.matchesLimitSearch(' alice ','Tokyo','Alice'));assert.ok(view.matchesLimitSearch('均衡','均衡 · 持续高速'));assert.ok(!view.matchesLimitSearch('Bob','Alice'));
});
