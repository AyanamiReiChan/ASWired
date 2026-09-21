const publicPaths=new Set(['/api/public/probe-servers','/api/public/probe-series','/api/public/appearance']);
const authenticatedPaths=new Map([['/api/me','GET'],['/api/logout','POST'],['/api/auth/callback/exchange','POST']]);
function response(body,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store'}});}
function masterURL(raw){const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('ASWIRED_MASTER_ORIGIN must be a HTTPS origin');return url;}
export default {async fetch(request,env){
 const incoming=new URL(request.url);let master;try{master=masterURL(env.ASWIRED_MASTER_ORIGIN);}catch{return response({error:{message:'探针主控来源未正确配置'}},503);}
 if(incoming.pathname==='/probe-config.json')return response({masterOrigin:master.origin});
 if(incoming.pathname.startsWith('/api/')){
  const expected=publicPaths.has(incoming.pathname)?'GET':authenticatedPaths.get(incoming.pathname);if(!expected||request.method!==expected)return response({error:{message:'该接口不属于独立探针'}},404);
  if(expected==='POST'&&request.headers.get('Origin')!==incoming.origin)return response({error:{message:'来源验证失败'}},403);
  const target=new URL(incoming.pathname+incoming.search,master);const headers=new Headers({'Accept':'application/json'});for(const key of ['Content-Type','Origin','MM-Authorization']){const value=request.headers.get(key);if(value)headers.set(key,value);}
  if(incoming.pathname==='/api/auth/callback/exchange')headers.delete('MM-Authorization');
  if(incoming.pathname.startsWith('/api/public/probe-')&&env.ASWIRED_PROBE_TOKEN)headers.set('X-MMwx-Probe-Token',env.ASWIRED_PROBE_TOKEN);
  let body;if(expected==='POST'){body=await request.text();if(new TextEncoder().encode(body).length>16384)return response({error:{message:'请求过大'}},413);}
  try{const upstream=await fetch(target,{method:expected,headers,body,redirect:'manual'});if(upstream.status>=300&&upstream.status<400)return response({error:{message:'主控接口不允许重定向'}},502);const resultHeaders=new Headers({'Content-Type':upstream.headers.get('Content-Type')||'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return new Response(upstream.body,{status:upstream.status,headers:resultHeaders});}catch{return response({error:{message:'无法连接主控'}},502);}
 }
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const asset=new URL(request.url);if(asset.pathname==='/'||asset.pathname==='/auth/callback')asset.pathname='/probe/index.html';const result=await env.ASSETS.fetch(new Request(asset,request));const headers=new Headers(result.headers);headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");return new Response(result.body,{status:result.status,headers});
}};
