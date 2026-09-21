import {dev} from '$app/environment';
import type {Handle} from '@sveltejs/kit';

// Internal design material is available only through the local dev server.
export const handle:Handle=async({event,resolve})=>{
 const path=event.url.pathname.replace(/\/+$/,'')||'/';
 if(!dev&&(path==='/design'||path.startsWith('/design/')||path==='/docs'||path.startsWith('/docs/'))){
  return new Response('Not found',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 }
 return resolve(event);
};
