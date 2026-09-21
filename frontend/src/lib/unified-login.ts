export type ProbeLogin = {kind:'komari';action:string;ticket:string};
export function probeLoginAction(response:ProbeLogin):string {
 const url=new URL(response.action);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/auth/aswired/session'||!(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))))throw new Error('无效的探针登录地址');
 if(typeof response.ticket!=='string'||response.ticket.length<32||response.ticket.length>256)throw new Error('无效的探针登录凭据');
 return url.href;
}
export function enterProbe(response:ProbeLogin){
 const action=probeLoginAction(response),form=document.createElement('form');form.method='POST';form.action=action;form.style.display='none';
 const input=document.createElement('input');input.type='hidden';input.name='ticket';input.value=response.ticket;form.append(input);document.body.append(form);form.submit();form.remove();
}
