import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/node-workbench.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {nodeProtocol,nodeAddress,renamedNode}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('node rows retain actual protocol and format IPv6 addresses without changing ports',()=>{
 assert.equal(nodeProtocol({protocol:'hysteria2'}),'HYSTERIA2');
 assert.equal(nodeProtocol({}),'未知');
 assert.equal(nodeAddress({host:'2001:db8::1',port:8443}),'[2001:db8::1]:8443');
 assert.equal(nodeAddress({host:'[2001:db8::1]',port:443}),'[2001:db8::1]:443');
 assert.equal(nodeAddress({host:'example.test',port:443}),'example.test:443');
});
test('batch naming uses literal replacement and exposes empty results for validation',()=>{
 assert.equal(renamedNode('a.b a.b','[','a.b','$&',']'),'[$& $&]');
 assert.equal(renamedNode('Tokyo','','','ignored',' 01'),'Tokyo 01');
 assert.equal(renamedNode('Tokyo','','Tokyo','',''),'');
});
