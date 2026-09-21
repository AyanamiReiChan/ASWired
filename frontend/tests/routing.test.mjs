import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/routing.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {parseRoutingJSON,setRuleField,isCatchAll,ruleApplies,moveRule,routingURL}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('malformed advanced JSON cannot replace the visual draft',()=>{
 for(const invalid of ['null','[]','{"rules":42}','{"rules":[null]}','{"rules":[{"domain":"example.com"}]}','{"balancers":[{"selector":"proxy-"}]}'])assert.throws(()=>parseRoutingJSON(invalid));
 assert.deepEqual(parseRoutingJSON('{"rules":[{"domain":["a"],"custom":true}]}').rules[0],{domain:['a'],custom:true});
});
test('editing fields omits empties and preserves advanced fields',()=>{
 const rule={type:'field',domain:['old'],outboundTag:'direct',custom:{keep:true}};
 assert.deepEqual(setRuleField(rule,'domain',' a, b, ,c ').domain,['a','b','c']);
 assert.equal(setRuleField(rule,'domain',' ').domain,undefined);
 assert.deepEqual(setRuleField(rule,'port','80,443').custom,{keep:true});
 assert.equal(setRuleField(rule,'port','80,443').port,'80,443');
});
test('scope and catch-all respect Xray AND semantics and extra fields',()=>{
 const rule={inboundTag:['a'],balancerTag:'pool',type:'field'};
 assert.equal(isCatchAll(rule),true);assert.equal(isCatchAll({...rule,attrs:'x'}),false);
 assert.equal(isCatchAll({...rule,source:['10.0.0.1']}),false);assert.equal(isCatchAll({...rule,unknown:true}),false);
 assert.equal(ruleApplies(rule,'b'),false);assert.equal(ruleApplies({domain:['a']},'b'),true);
});
test('reorder preserves API and first-match order',()=>{
 const rules=[{outboundTag:'api'},{domain:['a'],outboundTag:'block'},{network:'tcp,udp',outboundTag:'direct'}];
 assert.deepEqual(moveRule(rules,1,0),rules);
 assert.deepEqual(moveRule(rules,1,2),[rules[0],rules[2],rules[1]]);
});
test('managed node link carries real inbound tag and imported nodes have no routing link',()=>{
 assert.equal(routingURL('nodes',{serverId:'s',tag:'vless-one',managedInbound:true}),'/servers?xray=s&tab=routing&routingScope=vless-one');
 assert.equal(routingURL('nodes',{serverId:'s',tag:'imported'}),'');
});
