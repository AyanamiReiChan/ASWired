import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/overview.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {serverQuota,quotaSummary,liveRates,trafficRanking,dailyTraffic,overviewBytes}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const billed=(limitGB,usedBytes)=>({merchantTraffic:{configured:true,limitGB,usedBytes}});
test('quota uses decimal billing bytes and never subtracts lifetime NIC counters',()=>{
 assert.equal(serverQuota({limit:2000,observation:{network_tx_bytes:9e12,network_rx_bytes:1e12}}).used,null);
 assert.equal(serverQuota(billed(2000,734135845)).remaining,2e12-734135845);
 assert.equal(serverQuota(billed(1,2e9)).remaining,0);
 assert.equal(serverQuota(billed(1,2e9)).percent,200);
 assert.equal(serverQuota(billed(0,2e9)).remaining,null);
});
test('summary preserves per-server remaining and marks partial or unlimited quotas',()=>{
 const result=quotaSummary([billed(1,2e9),billed(3,1e9),{limit:5},billed(0,1e12),{}]);
 assert.equal(result.limit,9e9);assert.equal(result.used,3e9);assert.equal(result.remaining,2e9);
 assert.equal(result.unknown,1);assert.equal(result.unlimited,1);assert.equal(result.unconfigured,1);
 assert.equal(quotaSummary([]).limit,null);assert.equal(quotaSummary([{limit:1}]).used,null);
});
test('live rates exclude stale offline observations and missing samples',()=>{
 const result=liveRates([{status:'离线',probeOnline:true,upload:0,download:42},{status:'在线',upload:99999,download:99999},{status:'在线',probeOnline:true,upload:null,download:123},{status:'在线',probeOnline:false,upload:44,download:55}]);
 assert.equal(result.up,0);assert.equal(result.down,42);assert.equal(result.measured,1);assert.equal(result.online,2);
 assert.equal(liveRates([]).up,null);
});
test('rankings sort actual directional byte totals without mutating input or inventing unknown rows',()=>{
 const rows=[{name:'small',up:1,down:2},{name:'missing',up:null,down:3},{name:'large',up:5,down:6}];
 assert.deepEqual(trafficRanking(rows).map(row=>row.name),['large','small']);assert.equal(rows[0].name,'small');
});
test('daily chart converts ledger GiB once, retains missing dates and gap status',()=>{
 const result=dailyTraffic([{at:172800000,date:'2026-09-20',total:2,gap:true},{at:0,date:'2026-09-18',total:1},{at:86400000,date:'2026-09-19',total:null}]);
 assert.equal(result.samples.length,2);assert.equal(result.total,3*1024**3);assert.equal(result.samples[1].gap,true);
 assert.ok(result.maximum>=2*1024**3);assert.equal(overviewBytes(2e12),'2 TB');assert.equal(overviewBytes(null),'—');assert.equal(overviewBytes(0,true),'0 B/s');
});
