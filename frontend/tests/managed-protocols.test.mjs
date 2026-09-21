import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function moduleURL(name) {
 const source=fs.readFileSync(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8');
 let js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 js=js.replace(/from ['"]\.\/([^'"]+)['"]/g,(_,dependency)=>`from '${moduleURL(dependency)}'`);
 return 'data:text/javascript;base64,'+Buffer.from(js).toString('base64');
}
const {withManagedFields,protocolDefaults,protocolUnavailable,prepareManagedInbound,managedInboundError}=await import(moduleURL('managed-protocols'));
const {generateRealityKeyPair}=await import(moduleURL('reality-keys'));

test('protocol changes keep identity and require correct Agent capabilities',()=>{
 const row=protocolDefaults({id:'entry',serverId:'server',name:'entry',privateKey:'old'},'Trojan');
 assert.equal(row.id,'entry');assert.equal(row.security,'tls');assert.equal(row.flow,'无');
 assert.match(managedInboundError(row),/SNI/);
 assert(protocolUnavailable('Hysteria2',{}));assert(protocolUnavailable('AnyTLS',{capabilities:{anytls:true}}));
 assert.equal(protocolUnavailable('Hysteria2',{capabilities:{managed_protocols_v2:true}}),'');
 assert.equal(withManagedFields({id:'in',protocol:'ss',network:'tcp',security:'none'}).protocol,'Shadowsocks');
});
test('preview followed by save preserves Reality short IDs and derived public key',async()=>{
 const keys=await generateRealityKeyPair();
 const initial={id:'in',protocol:'VLESS',transport:'TCP / Reality',...keys,shortIds:'aabb, ccdd',allowEmptyShortId:true,sni:'example.test',target:'example.test:443',xver:0,maxTimeDiff:0,minClientVer:'',maxClientVer:''};
 const preview=await prepareManagedInbound(initial);const saved=await prepareManagedInbound(preview);
 assert.deepEqual(saved.shortIds,['aabb','ccdd','']);assert.equal(saved.publicKey,keys.publicKey);
 const converted=await prepareManagedInbound(protocolDefaults(saved,'Trojan'));
 assert.equal(converted.privateKey,undefined);assert.equal(converted.publicKey,undefined);assert.equal(converted.shortIds,undefined);
});
