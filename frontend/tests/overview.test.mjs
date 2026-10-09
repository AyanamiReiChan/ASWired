import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/overview.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {serverQuota,quotaSummary,liveRates,trafficRanking,serverPeriodRanking,dailyTraffic,overviewBytes}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
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
const systemBill=(id,bill={})=>({id,name:id,merchantTraffic:{configured:true,source:'system',direction:'sum',...bill}});
test('whole-server ranking uses the authoritative billing total including calibration and direction',()=>{
 const rows=[
  systemBill('download-only',{direction:'download',usedBytes:20,uploadBytes:500,downloadBytes:20,adjustmentBytes:0}),
  systemBill('calibrated',{usedBytes:100,uploadBytes:15,downloadBytes:25,adjustmentBytes:60}),
  systemBill('negative-calibration',{usedBytes:30,uploadBytes:20,downloadBytes:20,adjustmentBytes:-10}),
 ];
 const before=structuredClone(rows), ranked=serverPeriodRanking(rows);
 assert.deepEqual(ranked.map(row=>[row.id,row.bytes]),[['calibrated',100],['negative-calibration',30],['download-only',20]]);
 assert.equal(ranked[0].up+ranked[0].down,40);assert.equal(ranked[0].adjustmentBytes,60);
 assert.equal(ranked[1].adjustmentBytes,-10);assert.equal(ranked[2].direction,'download');
 assert.deepEqual(rows,before);assert.notEqual(ranked[0],rows[1]);
});
test('whole-server ranking keeps measured zero above unknown rows and never substitutes proxy or lifetime NIC usage',()=>{
 const rows=[
  {id:'missing',name:'Missing',up:9e12,down:8e12,observation:{network_tx_bytes:7e12,network_rx_bytes:6e12}},
  systemBill('zero',{usedBytes:0,uploadBytes:0,downloadBytes:0,limitGB:0}),
  systemBill('invalid',{usedBytes:NaN,uploadBytes:3,downloadBytes:4}),
  systemBill('proxy',{source:'xray',usedBytes:1e15,uploadBytes:4e14,downloadBytes:6e14}),
  systemBill('no-source',{source:undefined,usedBytes:1e15}),
  systemBill('disabled',{configured:false,usedBytes:1e15}),
 ];
 const ranked=serverPeriodRanking(rows);
 assert.equal(ranked[0].id,'zero');assert.equal(ranked[0].bytes,0);assert.equal(ranked[0].unknownReason,'');
 for(const row of ranked.slice(1)){assert.equal(row.bytes,null);assert.equal(row.up,null);assert.equal(row.down,null);assert.ok(row.unknownReason);}
 assert.match(ranked.find(row=>row.id==='proxy').unknownReason,/代理/);
 for(const value of [-1,Infinity,'42',null,undefined]) assert.equal(serverPeriodRanking([systemBill('bad',{usedBytes:value})])[0].bytes,null);
});
test('whole-server ranking preserves billing period and saved offline samples without inventing a new-period zero',()=>{
 const metadata={start:'2026-09-25T00:00:00Z',end:'2026-10-25T00:00:00Z',sampleAt:'2026-10-01T00:00:00Z',coverageStart:'2026-09-25T00:00:00Z',gap:true,gapReason:'采样间隔',usedBytes:100};
 const saved=serverPeriodRanking([{...systemBill('offline',metadata),probeOnline:false}])[0];
 assert.equal(saved.bytes,100);assert.equal(saved.periodStart,metadata.start);assert.equal(saved.periodEnd,metadata.end);
 assert.equal(saved.sampleAt,metadata.sampleAt);assert.equal(saved.coverageStart,metadata.coverageStart);assert.equal(saved.gap,true);assert.equal(saved.gapReason,'采样间隔');
 const emptyCycle={start:'2026-10-10T00:00:00Z',end:'2026-11-10T00:00:00Z',sampleAt:'2026-10-09T23:00:00Z',usedBytes:0,uploadBytes:0,downloadBytes:0,adjustmentBytes:0};
 assert.match(serverPeriodRanking([systemBill('not-sampled',emptyCycle)])[0].unknownReason,/本期尚无/);
 assert.equal(serverPeriodRanking([systemBill('not-sampled',{...emptyCycle,sampleAt:undefined})])[0].bytes,null);
 assert.equal(serverPeriodRanking([systemBill('measured-zero',{...emptyCycle,sampleAt:emptyCycle.start})])[0].bytes,0);
 assert.equal(serverPeriodRanking([systemBill('calibrated',{...emptyCycle,usedBytes:100,adjustmentBytes:100})])[0].bytes,100);
});
test('daily chart converts ledger GiB once, retains missing dates and gap status',()=>{
 const result=dailyTraffic([{at:172800000,date:'2026-09-20',total:2,gap:true},{at:0,date:'2026-09-18',total:1},{at:86400000,date:'2026-09-19',total:null}]);
 assert.equal(result.samples.length,2);assert.equal(result.total,3*1024**3);assert.equal(result.samples[1].gap,true);
 assert.ok(result.maximum>=2*1024**3);assert.equal(overviewBytes(2e12),'2 TB');assert.equal(overviewBytes(null),'—');assert.equal(overviewBytes(0,true),'0 B/s');
});
