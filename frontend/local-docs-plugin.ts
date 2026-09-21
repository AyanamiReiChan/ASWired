import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,relative,isAbsolute,extname} from 'node:path';
import type {Plugin} from 'vite';

// Deliberately has no build/preview hook: these files never become public assets.
export function localDesignDocs():Plugin{
 const root=fileURLToPath(new URL('./local-docs/',import.meta.url));
 return {name:'local-design-docs',apply:'serve',configureServer(server){
  server.middlewares.use(async(req,res,next)=>{
   if(!req.url?.startsWith('/docs/'))return next();
   try{
    const name=decodeURIComponent(req.url.split('?')[0].slice('/docs/'.length));
    const target=resolve(root,name),rel=relative(root,target);
    if(rel.startsWith('..')||isAbsolute(rel)||name.includes('\0')){res.statusCode=404;res.end();return;}
    const body=await readFile(target);
    res.setHeader('Content-Type',extname(target)==='.json'?'application/json; charset=utf-8':'text/plain; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    res.end(body);
   }catch{res.statusCode=404;res.end('Not found');}
  });
 }};
}
