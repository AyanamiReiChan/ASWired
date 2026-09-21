import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const flags=Object.fromEntries(fs.readdirSync(new URL('../static/flags/',import.meta.url)).filter(name=>/^[a-z]{2}\.svg$/.test(name)).map(name=>['/static/flags/'+name,{}]));
const source=fs.readFileSync(new URL('../src/lib/server-display.ts',import.meta.url),'utf8').replace("import.meta.glob('/static/flags/??.svg')",JSON.stringify(flags));
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {countryCode,hostTraffic,monthlyTrafficReset,trafficDirection}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('configured merchant billing uses calibrated bytes and its own monthly calendar',()=>{
 const row={merchantTraffic:{configured:true,usedBytes:1.5e9,direction:'download',resetDay:31,timezone:'Asia/Shanghai'},observation:{network_tx_bytes:9e9,network_rx_bytes:2e9}};
 assert.deepEqual(hostTraffic(row),{bytes:1.5e9,gb:1.5});
 assert.equal(monthlyTrafficReset(row),'每月 31 日 00:00（Asia/Shanghai）重置');
 assert.equal(trafficDirection(row),'仅下载');
});

test('country badge accepts Komari flags, ISO codes and localized country names',()=>{
 for(const value of ['🇺🇸','US','us',' 美国 ','United States']) assert.equal(countryCode(value),'US');
 assert.equal(countryCode('',undefined,'🇭🇰'),'HK');
 assert.equal(countryCode('日本','🇺🇸'),'JP');
 assert.equal(countryCode('UK'),'GB');
 assert.equal(countryCode('NW','Unknown'),'');
 assert.equal(countryCode('../../evil.svg'),'');
 assert.equal(countryCode('🇺'),'');
});

test('host traffic uses both measured counters and decimal GB, never a billing field',()=>{
 assert.deepEqual(hostTraffic({used:999,observation:{network_tx_bytes:1_200_000_000,network_rx_bytes:800_000_000}}),{bytes:2_000_000_000,gb:2});
 assert.deepEqual(hostTraffic({observation:{network_tx_bytes:0,network_rx_bytes:0}}),{bytes:0,gb:0});
 for(const observation of [undefined,{}, {network_tx_bytes:1},{network_tx_bytes:-1,network_rx_bytes:2},{network_tx_bytes:'1',network_rx_bytes:2},{network_tx_bytes:Infinity,network_rx_bytes:2}]) assert.equal(hostTraffic({observation}),null);
});

test('monthly label requires a configured period bound to the selected Komari identity',()=>{
 const row={probeSource:'komari',komariUUID:'node-1',trafficPeriod:'monthly',trafficPeriodKomariUUID:'node-1',trafficResetDay:22,trafficResetTimezone:'Asia/Shanghai'};
 assert.equal(monthlyTrafficReset(row),'每月 22 日 00:00（北京时间）重置');
 for(const change of [{probeSource:'native'},{komariUUID:'node-2'},{trafficPeriod:undefined},{trafficResetDay:0},{trafficResetDay:29},{trafficResetDay:'22'},{trafficResetTimezone:'UTC'}]) assert.equal(monthlyTrafficReset({...row,...change}),null);
 assert.equal(monthlyTrafficReset({}),null);
});
