import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/server-inbounds.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {belongsToServer,inboundPreview,inboundManagerURL}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('server identity takes priority over legacy matching names',()=>{
 const server={id:'a',name:'same'};
 assert(belongsToServer({id:'in',serverId:'a',server:'old'},server));
 assert(!belongsToServer({id:'in',serverId:'b',server:'same'},server));
 assert(belongsToServer({id:'in',server:'same'},server));
});
test('structural preview hides credentials and carries advanced settings',()=>{
 const row={id:'in',tag:'entry',port:443,sni:'one.test, two.test',shortIds:'abcdef',allowEmptyShortId:true,privateKey:'secret',target:'one.test:443',sniffing:'仅路由',streamSettings:{sockopt:{tcpFastOpen:true}}};
 const preview=inboundPreview(row);
 assert(!JSON.stringify(preview).includes('secret'));assert.deepEqual(preview.settings.clients,[]);
 assert.deepEqual(preview.streamSettings.realitySettings.shortIds,['abcdef','']);
 assert.equal(preview.sniffing.routeOnly,true);assert.equal(preview.streamSettings.sockopt.tcpFastOpen,true);
 assert.equal(inboundPreview({...row,sniffing:'关闭'}).sniffing,undefined);
});
test('managed node links identify server, inbound and tab without ambiguous query characters',()=>{
 const url=new URL(inboundManagerURL({id:'node',serverId:'server & 1',inboundId:'in/1'}),'https://example.test');
 assert.equal(url.pathname,'/servers');assert.equal(url.searchParams.get('xray'),'server & 1');assert.equal(url.searchParams.get('inbound'),'in/1');assert.equal(url.searchParams.get('tab'),'inbounds');
});
