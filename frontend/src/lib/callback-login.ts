const KEY='aswired-login-callback';
const encoded=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export type CallbackRequest={state:string;verifier:string;redirectURI:string;createdAt:number};
export function secureOrigin(raw:string){const url=new URL(raw);if(url.username||url.password||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw new Error('登录回接地址须为 HTTPS 或本机地址');return url;}
export async function startCallbackLogin(masterOrigin:string,redirectURI=location.origin+'/auth/callback'){
 const master=secureOrigin(masterOrigin),redirect=secureOrigin(redirectURI);if(redirect.origin!==location.origin)throw new Error('回接地址必须属于当前站点');
 const verifier=encoded(crypto.getRandomValues(new Uint8Array(32))),state=encoded(crypto.getRandomValues(new Uint8Array(24))),challenge=encoded(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 sessionStorage.setItem(KEY,JSON.stringify({state,verifier,redirectURI:redirect.href,createdAt:Date.now()} satisfies CallbackRequest));
 const target=new URL('/auth/authorize',master.origin);target.search=new URLSearchParams({redirect_uri:redirect.href,code_challenge:challenge,code_challenge_method:'S256',state}).toString();location.assign(target.href);
}
export function consumeCallback(search:string):{code:string;code_verifier:string;redirect_uri:string}{
 const query=new URLSearchParams(search),raw=sessionStorage.getItem(KEY);sessionStorage.removeItem(KEY);if(!raw)throw new Error('没有找到本次登录请求，请从探针页面重新登录');
 let request:CallbackRequest;try{request=JSON.parse(raw);}catch{throw new Error('登录请求已失效');}
 if(!request.state||request.state!==query.get('state')||!request.verifier||!Number.isFinite(request.createdAt)||Date.now()-request.createdAt>10*60*1000||request.createdAt>Date.now()+1000)throw new Error('登录请求不匹配或已过期，请重新登录');
 const redirect=secureOrigin(request.redirectURI);if(redirect.origin!==location.origin||redirect.pathname!==location.pathname)throw new Error('登录回接地址不匹配');const code=query.get('code');if(!code)throw new Error('回接未携带授权码');return {code,code_verifier:request.verifier,redirect_uri:request.redirectURI};
}
