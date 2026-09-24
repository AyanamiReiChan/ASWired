export type UpgradeBackup = {
 id:string; createdAt:string; previousVersion:string; sizeBytes:number;
 files:{name:string;sizeBytes:number}[]; deletable:boolean; reason?:string;
};
export type UpgradeBackupStatus = {
 supported:boolean; reason?:string; phase:'idle'|'queued'|'scanning'|'deleting'|'completed'|'failed';
 requestId?:string; operation?:string; backupId?:string; message?:string; updatedAt?:string;
 items:UpgradeBackup[]; totalSizeBytes:number; truncated?:boolean; remainingCount?:number;
};
type Options = {
 request:(path:string,init?:RequestInit)=>Promise<UpgradeBackupStatus>;
 identity:()=>string; updating?:()=>boolean; visible?:()=>boolean;
 schedule?:(callback:()=>void,delay:number)=>ReturnType<typeof setTimeout>;
 cancel?:(timer:ReturnType<typeof setTimeout>)=>void;
};
type State = {status:UpgradeBackupStatus|null;loading:boolean;submitting:boolean;error:string;needsVerification:boolean};
const base='/api/system/upgrade-backups';
export const backupOperationPending=(status:UpgradeBackupStatus|null)=>!!status?.supported&&['queued','scanning','deleting'].includes(status.phase);

export function createUpgradeBackups(options:Options){
 const empty=():State=>({status:null,loading:false,submitting:false,error:'',needsVerification:false});
 let state=$state<State>(empty()),owner='',generation=0,started=false,stopped=false;
 let controller:AbortController|undefined,timer:ReturnType<typeof setTimeout>|undefined;
 const schedule=options.schedule??setTimeout,cancel=options.cancel??clearTimeout;
 function cancelPoll(){if(timer!==undefined){cancel(timer);timer=undefined;}}
 function clear(){generation++;controller?.abort();controller=undefined;cancelPoll();state=empty();started=false;}
 function syncIdentity(){const identity=options.identity();if(identity!==owner){clear();owner=identity;}}
 function allowed(){syncIdentity();if(stopped)return false;if(!owner){state.error='只有管理员可以管理系统升级备份';return false;}return true;}
 function current(run:number,identity:string){
  if(run!==generation||stopped)return false;
  if(identity!==options.identity()){syncIdentity();return false;}
  return true;
 }
 function planPoll(){
  cancelPoll();
  if(stopped||!backupOperationPending(state.status)||!owner)return;
  timer=schedule(async()=>{timer=undefined;if(options.visible?.()===false){planPoll();return;}await readStatus();},3000);
 }
 function checked(value:UpgradeBackupStatus){
  if(!value||typeof value.supported!=='boolean'||!['idle','queued','scanning','deleting','completed','failed'].includes(value.phase)||!Array.isArray(value.items)||typeof value.totalSizeBytes!=='number'||!Number.isFinite(value.totalSizeBytes)||value.totalSizeBytes<0)throw new Error('主控返回的升级备份状态无效，请刷新重试');
  const ids=new Set<string>(),validSize=(size:unknown)=>typeof size==='number'&&Number.isFinite(size)&&size>=0;
  for(const item of value.items){
   if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id)||typeof item.createdAt!=='string'||typeof item.previousVersion!=='string'||!validSize(item.sizeBytes)||typeof item.deletable!=='boolean'||!Array.isArray(item.files)||item.files.some(file=>!file||typeof file.name!=='string'||!validSize(file.sizeBytes)))throw new Error('主控返回的升级备份清单无效，请刷新重试');
   ids.add(item.id);
  }
  return value;
 }
 async function send(path:string,init:RequestInit={},operation=''){
  if(!allowed()||state.loading||state.submitting)return false;
  cancelPoll();const run=generation,identity=owner,active=new AbortController();controller=active;
  const mutation=!!operation;state.loading=!mutation;state.submitting=mutation;state.error='';
  try{
   const result=checked(await options.request(path,{...init,signal:active.signal}));
   if(!current(run,identity)||active.signal.aborted)return false;
   if(mutation&&result.supported){
    // A 202 receipt only acknowledges the request. Keep the last inventory
    // until a subsequent GET reports the worker's completed result.
    state.status={...result,phase:backupOperationPending(result)?result.phase:'queued',operation,items:state.status?.items??result.items,totalSizeBytes:state.status?.totalSizeBytes??result.totalSizeBytes,message:'请求已受理，等待执行结果'};
   }else state.status=result;
   state.needsVerification=false;
   return true;
  }catch(cause){
   if(!current(run,identity)||active.signal.aborted)return false;
   const status=Number((cause as {status?:number})?.status);
   if(status===401||status===403){state.status=null;state.error=status===403?'没有管理系统升级备份的权限':'登录已过期，请重新登录';}
   else{
    state.error=cause instanceof Error?cause.message:'升级备份状态读取失败，请重试';
    if(mutation&&(!status||status>=500)){state.needsVerification=true;state.error+='；请求结果尚未确认，请刷新状态后再操作';}
   }
   return false;
  }finally{
   if(current(run,identity)){controller=undefined;state.loading=false;state.submitting=false;planPoll();}
  }
 }
 async function readStatus(){return send(base);}
 async function start(){
  stopped=false;if(!allowed()||started)return;started=true;
  const run=generation,identity=owner;
  if(await readStatus()&&current(run,identity)&&state.status?.supported&&!backupOperationPending(state.status))await refresh();
 }
 async function refresh(){
  if(!allowed()||state.loading||state.submitting)return false;
  if(state.needsVerification)return readStatus();
  if(!state.status||!state.status.supported){const run=generation,identity=owner;if(!await readStatus()||!current(run,identity))return false;}
  if(!state.status?.supported)return false;
  if(backupOperationPending(state.status))return readStatus();
  return send(base+'/refresh',{method:'POST'},'refresh');
 }
 function canRemove(id:string){
  return !!owner&&owner===options.identity()&&!stopped&&!state.loading&&!state.submitting&&!state.needsVerification&&!options.updating?.()&&state.status?.supported===true&&!backupOperationPending(state.status)&&state.status.items.some(item=>item.id===id&&item.deletable===true);
 }
 async function remove(id:string,confirmation:string){
  if(!allowed())return false;
  if(confirmation!==id||!id){state.error='请输入完整备份 ID 确认删除';return false;}
  if(!canRemove(id)){state.error=options.updating?.()?'系统正在升级，暂不能删除升级备份':'该备份目前不能删除，请刷新列表后重试';return false;}
  return send(base+'/'+encodeURIComponent(id),{method:'DELETE',body:JSON.stringify({confirm:id})},'delete');
 }
 async function resume(){if(allowed()&&backupOperationPending(state.status)&&!state.loading&&!state.submitting&&options.visible?.()!==false)await readStatus();}
 function stop(){stopped=true;clear();}
 return {get state(){return state;},start,refresh,remove,canRemove,resume,syncIdentity,stop};
}
