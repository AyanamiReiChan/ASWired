import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/probe-history.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {probeSamples,historyCurve,formatProbeValue}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('probe memory percentage requires a matching finite capacity sample',()=>{
 const series=probeSamples({mem_used:[{t:0,value:512},{t:300,value:10},{t:600,value:1},{t:900,value:1}],mem_total:[{t:0,value:1024},{t:300,value:0},{t:600,value:Infinity}]},'mem_pct');
 assert.deepEqual(series,[{t:0,value:50}]);
});
test('probe curves keep real time spacing and break across missing buckets',()=>{
 const series=[{t:0,value:0},{t:300,value:50},{t:1200,value:100}];
 assert.equal(historyCurve(series,100,300),'M 0 180 L 180 100 M 720 20');
 assert.equal(formatProbeValue(1048576,'upload_speed'),'1.00 MB/s');
 assert.equal(formatProbeValue(12,'latency_ms'),'12.0 ms');
 assert.deepEqual(probeSamples({cpu_pct:[{t:0,value:NaN},{t:300,value:0}]},'cpu_pct'),[{t:300,value:0}]);
});
