import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/certificates.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {certificateDomains,websiteCertificateStatus}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('root and wildcard selection normalizes and deduplicates SANs',()=>{
 assert.deepEqual(certificateDomains('EXAMPLE.com., *.example.com\nexample.com',true),['example.com','*.example.com']);
 assert.deepEqual(certificateDomains('panel.example.com, probe.example.com'),['panel.example.com','probe.example.com']);
 assert.deepEqual(certificateDomains('*.example.com'),['*.example.com']);
});
test('unverified or failed website checks never appear valid',()=>{
 assert.equal(websiteCertificateStatus({status:'valid',verified:false}).kind,'warning');
 assert.equal(websiteCertificateStatus({status:'invalid',verified:false}).kind,'danger');
 assert.equal(websiteCertificateStatus({status:'valid',verified:true}).kind,'success');
 assert.equal(websiteCertificateStatus({status:'unconfigured'}).label,'未配置');
});
