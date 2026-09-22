import type {Handle} from '@sveltejs/kit';

// The retired design page and internal documents are not website routes.
export const handle:Handle=async({event,resolve})=>{
 const path=event.url.pathname.replace(/\/+$/,'')||'/';
 if(path==='/design'||path.startsWith('/design/')||path==='/docs'||path.startsWith('/docs/')){
  return new Response('Not found',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 }
 return resolve(event);
};
