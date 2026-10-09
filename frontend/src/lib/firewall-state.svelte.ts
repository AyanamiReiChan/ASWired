import {checkedFirewallSnapshot,firewallTaskPending,firewallTaskUnknown,type FirewallSnapshot,type FirewallRule,type FirewallTask} from './firewall';
type Options={request:(path:string,init?:RequestInit)=>Promise<any>;identity:()=>string;visible:()=>boolean;schedule?:(callback:()=>void,delay:number)=>ReturnType<typeof setTimeout>;cancel?:(timer:ReturnType<typeof setTimeout>)=>void;pollLimit?:number};
type State={serverId:string;snapshot:FirewallSnapshot|null;loading:boolean;submitting:boolean;polling:boolean;error:string;notice:string;verificationPending:boolean};

export function createFirewallManager(options:Options){
 const empty=():State=>({serverId:'',snapshot:null,loading:false,submitting:false,polling:false,error:'',notice:'',verificationPending:false});
 let state=$state<State>(empty()),owner='',generation=0,stopped=true,attempts=0;
 let controller:AbortController|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 const schedule=options.schedule??setTimeout,cancel=options.cancel??clearTimeout;
 const base=()=>`/api/servers/${encodeURIComponent(state.serverId)}/firewall`;
 function cancelPoll(){if(timer!==undefined){cancel(timer);timer=undefined;}state.polling=false;}
 function invalidate(){generation++;controller?.abort();controller=undefined;cancelPoll();state.loading=false;state.submitting=false;}
 function stop(){stopped=true;invalidate();owner='';state=empty();}
 function syncIdentity(){if(owner&&owner!==options.identity())stop();}
 function allowed(){syncIdentity();return !stopped&&!!owner&&!!state.serverId&&options.visible();}
 function current(run:number,identity:string,id:string){if(run!==generation||stopped)return false;if(identity!==options.identity()){stop();return false;}return id===state.serverId&&options.visible();}
 function failure(cause:unknown,mutation=false){
  const code=Number((cause as {status?:number})?.status);
  if(code===401||code===403){state.snapshot=null;state.error=code===401?'登录已过期，请重新登录':'没有管理端口访问控制的权限';cancelPoll();return;}
  state.error=cause instanceof Error?cause.message:'请求失败，请重新载入';
  if(mutation&&(!code||code>=500)){state.verificationPending=true;state.error+='；请求可能已受理，请先重新载入以核实结果';}
 }
 function planPoll(){
  cancelPoll();if(!allowed()||!firewallTaskPending(state.snapshot?.task))return;
  if(attempts>=(options.pollLimit??45)){state.notice='仍在等待 Agent。自动检查已暂停，可查看任务或点击“重新载入”。';return;}
  state.polling=true;timer=schedule(async()=>{timer=undefined;state.polling=false;await pollTask();},2000);
 }
 async function read(){
  if(!allowed()||state.loading||state.submitting)return false;
  // A manual reload can replace an in-flight task poll. Its older response
  // must not overwrite the freshly read desired policy or restart polling.
  invalidate();const run=generation,identity=owner,id=state.serverId,active=new AbortController();controller=active;state.loading=true;state.error='';
  try{const snapshot=checkedFirewallSnapshot(await options.request(base(),{signal:active.signal}),id);if(!current(run,identity,id)||active.signal.aborted)return false;state.snapshot=snapshot;state.verificationPending=false;return true;}
  catch(cause){if(current(run,identity,id)&&!active.signal.aborted)failure(cause);return false;}
  finally{if(current(run,identity,id)){controller=undefined;state.loading=false;if(!state.error)planPoll();}}
 }
 async function pollTask(){
  if(!allowed()||state.loading||state.submitting||!firewallTaskPending(state.snapshot?.task))return;
  const run=generation,identity=owner,id=state.serverId,taskId=state.snapshot!.task!.id,active=new AbortController();controller=active;state.polling=true;attempts++;
  let terminal=false;
  try{
   const result=await options.request(`/api/collections/tasks/${encodeURIComponent(taskId)}`,{signal:active.signal});
   if(!current(run,identity,id)||active.signal.aborted)return;
   const task=result?.row as FirewallTask;if(!task||task.id!==taskId||typeof task.status!=='string')throw new Error('主控返回的任务状态无效，请重新载入');
   if(state.snapshot)state.snapshot={...state.snapshot,task};state.error='';terminal=!firewallTaskPending(task);
  }catch(cause){if(current(run,identity,id)&&!active.signal.aborted)failure(cause);}
  finally{if(current(run,identity,id)){controller=undefined;state.polling=false;if(!state.error){if(terminal)await read();else planPoll();}}}
 }
 async function start(serverId:string){
  const identity=options.identity();if(!identity||!serverId){stop();return false;}
  if(!stopped&&owner===identity&&state.serverId===serverId)return true;
  stop();stopped=false;owner=identity;state.serverId=serverId;attempts=0;return read();
 }
 async function write(method:'PUT'|'POST',rules?:FirewallRule[],revision?:number){
  if(!allowed()||state.loading||state.submitting||state.polling||!state.snapshot)return false;
  if(state.verificationPending){state.error='请先重新载入，核实上次请求结果';return false;}
  if(!state.snapshot.capable){state.error='请先升级此服务器的 Agent，并确认 Linux 已安装 nftables';return false;}
  if(firewallTaskPending(state.snapshot.task)||(method==='PUT'&&firewallTaskUnknown(state.snapshot.task))){state.error='上次任务尚未确认，请先读取实际状态或查看任务';return false;}
  if(method==='PUT'&&revision!==state.snapshot.revision){state.error='主控策略已变化，请重新载入配置后再编辑';return false;}
  cancelPoll();const run=generation,identity=owner,id=state.serverId,active=new AbortController();controller=active;state.submitting=true;state.error='';state.notice='';
  try{
   const result=await options.request(base()+(method==='POST'?'/refresh':''),{method,signal:active.signal,...(method==='PUT'?{body:JSON.stringify({revision,rules})}:{})});
   if(!current(run,identity,id)||active.signal.aborted)return false;
   if(result?.serverId)state.snapshot=checkedFirewallSnapshot(result,id);
   else if(result?.task?.id)state.snapshot={...state.snapshot!,task:result.task};
   else throw new Error('主控未返回执行任务，请重新载入核实结果');
   state.verificationPending=true;state.notice=method==='PUT'?'策略已保存并提交，等待 Agent 实际执行回报。':'已请求节点读取实际防火墙状态，等待 Agent 回报。';attempts=0;
   return true;
  }catch(cause){if(current(run,identity,id)&&!active.signal.aborted)failure(cause,true);return false;}
  finally{if(current(run,identity,id)){controller=undefined;state.submitting=false;if(!state.error)await read();}}
 }
 async function reload(){attempts=0;return read();}
 function pause(){if(state.submitting){state.verificationPending=true;state.notice='请求已发出，恢复页面后会核实结果。';}invalidate();}
 async function resume(){if(!allowed())return false;return read();}
 return {get state(){return state;},start,reload,save:(rules:FirewallRule[],revision:number)=>write('PUT',rules,revision),refresh:()=>write('POST'),pause,resume,syncIdentity,stop};
}
