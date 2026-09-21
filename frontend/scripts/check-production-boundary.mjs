import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';

const root=resolve('build');
if(!existsSync(root))throw new Error('Missing production build');
function inspect(dir){
 for(const entry of readdirSync(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);
  if(entry.isDirectory()){
   if(['docs','local-docs'].includes(entry.name))throw new Error(`Local design documents leaked into build: ${path}`);
   inspect(path);
  }else if(/\.(js|json|map)$/.test(entry.name)){
   const text=readFileSync(path,'utf8');
   if(/设计与功能覆盖|从设计到连接|aswired-alignment\.json|pages\/Design\.svelte/.test(text))throw new Error(`Local design page leaked into build: ${path}`);
  }
 }
}
inspect(root);
console.log('Production boundary passed: no design page or internal documents.');
