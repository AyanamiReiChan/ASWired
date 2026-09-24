import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source=fs.readFileSync(new URL('../src/lib/behavior-presets.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {createBehaviorPreset,matchingBehaviorPreset,parseBehaviorDraft,sustainedRuleSummary}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('balanced defaults permit short high speed and prioritize the longer sustained limit',()=>{
 const config=createBehaviorPreset();
 assert.deepEqual(config,{enabled:true,maxGapSeconds:15,rules:[
  {id:'balanced-long',type:'sustained',thresholdMbps:80,durationSeconds:600,limitMbps:30,penaltySeconds:600,priority:10,notify:false},
  {id:'balanced-high',type:'sustained',thresholdMbps:200,durationSeconds:120,limitMbps:50,penaltySeconds:600,priority:20,notify:false},
 ]});
});

test('relaxed and strict previews have their documented sustained thresholds and no burst sampling triggers',()=>{
 for(const [preset,expected] of [
  ['relaxed',[[150,900,80,600],[300,180,100,300]]],
  ['strict',[[50,600,20,900],[100,120,30,600]]],
 ]){
  const config=createBehaviorPreset(preset);
  assert.equal(config.enabled,true);assert.equal(config.maxGapSeconds,15);
  assert.deepEqual(config.rules.map(rule=>[rule.thresholdMbps,rule.durationSeconds,rule.limitMbps,rule.penaltySeconds]),expected);
  assert.deepEqual(config.rules.map(rule=>rule.priority),[10,20]);
  for(const rule of config.rules){assert.equal(rule.type,'sustained');assert.equal(rule.notify,false);assert.equal('hits' in rule,false);assert.equal('windowSeconds' in rule,false);}
 }
});

test('editing or previewing a preset never changes another editor or the builtin fallback',()=>{
 const saved=createBehaviorPreset(),draft=createBehaviorPreset();
 draft.rules[0].thresholdMbps=1;draft.rules.push({...draft.rules[1],id:'custom'});draft.enabled=false;
 for(const preset of ['relaxed','strict','balanced']){const preview=createBehaviorPreset(preset);preview.rules.reverse();}
 assert.deepEqual(createBehaviorPreset(),saved);
 assert.equal(matchingBehaviorPreset(saved),'balanced');assert.equal(matchingBehaviorPreset(draft),null);
});

test('missing/null drafts remain inheritance while every explicit object is preserved',()=>{
 for(const value of ['', '  ', 'null'])assert.deepEqual(parseBehaviorDraft(value),{config:null,error:''});
 for(const config of [{},{rules:[]},{enabled:false},{enabled:false,rules:[{id:'kept',type:'burst',windowSeconds:60,hits:5}]},{enabled:true,rules:[{id:'custom',thresholdMbps:17}],unknown:'keep-me'}]){
  const text=JSON.stringify(config,null,2),parsed=parseBehaviorDraft(text);
  assert.deepEqual(parsed,{config,error:''});assert.equal(matchingBehaviorPreset(parsed.config),null);
  for(const preset of ['balanced','relaxed','strict'])createBehaviorPreset(preset);
  assert.deepEqual(parsed.config,config);assert.equal(JSON.stringify(parsed.config,null,2),text);
 }
});

test('recognition tolerates JSON key order but never labels custom or disabled rules as defaults',()=>{
 const balanced=createBehaviorPreset();
 const reordered={rules:balanced.rules.map(rule=>Object.fromEntries(Object.entries(rule).reverse())),maxGapSeconds:15,enabled:true};
 assert.equal(matchingBehaviorPreset(reordered),'balanced');
 for(const change of [config=>config.enabled=false,config=>config.rules=[],config=>config.rules[0].thresholdMbps=81,config=>config.rules[0].notify=true,config=>config.extra='custom']){
  const config=createBehaviorPreset();change(config);assert.equal(matchingBehaviorPreset(config),null);
 }
 assert.equal(matchingBehaviorPreset(null),null);
});

test('invalid JSON or nonobject values are not silently turned into a preset',()=>{
 for(const value of ['{broken','[]','false','true','10','"balanced"']){const result=parseBehaviorDraft(value);assert.equal(result.config,null);assert.notEqual(result.error,'');}
 assert.throws(()=>createBehaviorPreset('constructor'),/未知/);
 assert.throws(()=>createBehaviorPreset('unrecognized'),/未知/);
});

test('preset summaries clearly state the trigger, sustained duration, speed and release duration',()=>{
 assert.equal(sustainedRuleSummary(createBehaviorPreset().rules[1]),'下载持续达到或超过 200 Mbps 达 2 分钟，限至 50 Mbps，持续 10 分钟');
 assert.equal(sustainedRuleSummary(createBehaviorPreset().rules[0]),'下载持续达到或超过 80 Mbps 达 10 分钟，限至 30 Mbps，持续 10 分钟');
});
