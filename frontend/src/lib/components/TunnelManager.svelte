<script lang="ts">
 import {onDestroy} from 'svelte';
 import type {Row} from '../data';
 import {api,demo,saveRow,getRow,removeRow,runAction,errorMessage} from '../store.svelte';
 import {addressPort,tunnelLegs,validateTunnel,type TunnelHop} from '../tunnels';
 import Modal from './Modal.svelte';import Icon from './Icon.svelte';import AppSelect from './Select.svelte';import RelayManager from './RelayManager.svelte';
 let {open=$bindable(false)}=$props<{open?:boolean}>();
 let tab=$state('隧道配置'),view=$state<'list'|'create'|'delete'>('list'),chain=$state(false),busy=$state(false),error=$state(''),notice=$state('');
 let name=$state(''),protocol=$state('tcp'),target=$state(''),hops=$state<TunnelHop[]>([]),savedId=$state(''),selected=$state<Row|null>(null);
 let taskIds=$state<string[]>([]),probing=$state(''),results=$state<Record<string,{label:string;value:string}[]>>({});
 let alive=true,probeGeneration=0;
 const rows=$derived((demo.data.forwards??[]).filter(row=>!row.chainId));
 const serverChoices=$derived([{value:'',label:'选择服务器'},...demo.data.servers.filter(s=>(!s.xray_mode||s.xray_mode==='embedded')&&(!s.connection||['auto','自动','WebSocket','websocket','HTTP','http','pull','轮询'].includes(s.connection))).map(s=>({value:s.id,label:s.name}))]);
 const serverName=(id:string)=>demo.data.servers.find(s=>s.id===id)?.name??id??'未知服务器';
 const legs=(row:Row)=>tunnelLegs(row,demo.data.servers);
 const protocols=(row:Row)=>[...new Set(legs(row).map(h=>h.protocol.toUpperCase()))].join(', ');
 function route(row:Row){return [...new Set(legs(row).map(h=>`${serverName(h.serverId)} :${addressPort(h.listen)}`))].join(' → ')+' → '+String(row.target||row.rules?.[0]?.target||'未设置目标');}
 $effect(()=>{if(!open){probeGeneration++;probing='';}});
 onDestroy(()=>{alive=false;probeGeneration++;});
 function start(isChain:boolean){chain=isChain;view='create';name='';target='';protocol='tcp';savedId='';hops=Array.from({length:isChain?2:1},()=>({serverId:'',listen:'0.0.0.0:8443'}));error='';notice='';}
 async function waitTask(id:string,active=()=>alive):Promise<Row>{
  for(let attempt=0;attempt<45;attempt++){
   if(!active())throw new Error('已停止等待任务；已提交的任务仍可在任务记录查看');
   const task=await getRow('tasks',id);
   if(['成功','success'].includes(task.status))return task;
   if(!['待下发','执行中','queued','running'].includes(task.status))throw new Error(task.error||`任务${task.status}`);
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw new Error('等待 Agent 超时，配置记录已保留，请核对任务后重试');
 }
 function remember(result:any){const ids=[result.task?.id,...(result.chain?.taskIds??[])].filter(Boolean);taskIds=[...new Set([...taskIds,...ids])];return result.task?.id as string|undefined;}
 async function save(apply:boolean){
  if(busy)return;busy=true;error='';
  try{
   validateTunnel(name,hops,target,chain);
   const rules=(protocol==='both'?['tcp','udp']:[protocol]).map(p=>({protocol:p,listen:hops[0].listen,target}));
   const row=await saveRow('forwards',{id:savedId||crypto.randomUUID(),name:name.trim(),status:'启用',...(chain?{hops,protocol,target}:{serverId:hops[0].serverId,rules})});savedId=row.id;
   if(apply)remember(await runAction(chain?'forward.chain.apply':'forward.apply',row.id,'forwards'));
   notice=apply?'配置已保存并提交，请查看任务执行结果。':'配置已保存，尚未应用。';view='list';
  }catch(e){error=errorMessage(e);}finally{busy=false;}
 }
 async function apply(row:Row){if(busy)return;busy=true;error='';try{if(!row.hops?.length&&['禁用','停用'].includes(row.status))await saveRow('forwards',{...row,status:'启用'});remember(await runAction(row.hops?.length?'forward.chain.apply':'forward.apply',row.id,'forwards'));notice='已提交应用，请核对任务执行结果。';}catch(e){error=errorMessage(e);}finally{busy=false;}}
 async function probe(row:Row){
  if(probing||busy)return;const generation=++probeGeneration;probing=row.id;error='';results[row.id]=[];
  const active=()=>alive&&open&&generation===probeGeneration;
  try{
   const unique=[...new Map(legs(row).map(h=>[h.serverId+'|'+h.target,h])).values()];
   for(const leg of unique){
    if(!active())break;
    // TCP connection tests do not validate a UDP service. For UDP-only tunnels, test host reachability with ICMP.
    const method=protocols(row)==='UDP'?'icmp':'tcp';
    const destination=method==='icmp'?leg.target.replace(/:\d+$/,'').replace(/^\[|\]$/g,''):leg.target;
    const label=`${serverName(leg.serverId)} → ${leg.target} · ${method.toUpperCase()}`;
    try{
     const result=await runAction('network.quality',leg.serverId,undefined,{method,target:destination,count:3,timeout_ms:1000});
     const id=remember(result);if(!id)throw new Error('主控未返回探测任务');
     const task=await waitTask(id,active);const data=task.result??{};
     if(active())results[row.id]=[...(results[row.id]??[]),{label,value:typeof data.average_ms==='number'?`${data.average_ms.toFixed(1)} ms · 失败 ${data.failure_percent??0}%`:'探测失败，未获得有效延迟'}];
    }catch(e){if(active())results[row.id]=[...(results[row.id]??[]),{label,value:errorMessage(e)}];}
   }
  }finally{if(generation===probeGeneration)probing='';}
 }
 async function remove(){
  if(busy||!selected)return;busy=true;error='';const row=selected;
  try{
   // Fetch current children from the controller; internal hop records never appear as separate tunnels.
   const all=await api<{rows:Row[]}>('/api/collections/forwards');
   const children=all.rows.filter(item=>item.chainId===row.id);
   if(row.hops?.length&&children.length){const state=await runAction('forward.chain.status',row.id);if(['ready','waiting','dispatching'].includes(state.chain?.status))throw new Error('转发链正在发布，请等待发布结束后再删除');}
   const members=row.hops?.length?children:[row];
   for(const member of members){const id=remember(await runAction('forward.disable',member.id,'forwards'));if(!id)throw new Error('主控未返回停用任务，保留记录');await waitTask(id);}
   for(const child of children)await removeRow('forwards',child.id);
   await removeRow('forwards',row.id);selected=null;view='list';notice='隧道已停用并删除。';
  }catch(e){error=errorMessage(e);}finally{busy=false;}
 }
</script>

<Modal bind:open title="Tunnel 管理" description="管理所有服务器上的端口转发与隧道。Tunnel 独立于节点列表，在这里配置和删除。">
 <button class="button small tunnel-close" aria-label="关闭 Tunnel 管理" disabled={busy} onclick={()=>open=false}><Icon name="x" size={20}/></button>
 <div class="tunnel-tabs" aria-label="Tunnel 分类">{#each ['隧道配置','中转配置'] as item}<button class:active={tab===item} aria-pressed={tab===item} disabled={busy} onclick={()=>{tab=item;view='list';error='';}}>{item}</button>{/each}</div>
 {#if error}<p class="error" role="alert">{error}</p>{/if}
 {#if tab==='中转配置'}<RelayManager bind:busy/>
 {:else if view==='create'}
  <div class="tunnel-toolbar"><h3>{chain?'链式转发':'端口转发'}</h3><button class="button small" disabled={busy} onclick={()=>{view='list';error='';}}>返回列表</button></div>
  <div class="form-grid"><label class="field">隧道名称<input bind:value={name} disabled={busy} placeholder="例如 tunnel-tw"/></label><label class="field">转发协议<AppSelect bind:value={protocol} disabled={busy} options={[{value:'tcp',label:'TCP'},{value:'udp',label:'UDP'},...(chain?[]:[{value:'both',label:'TCP, UDP'}])]} aria-label="转发协议"/></label></div>
  <div class="hop-list">{#each hops as hop,index}<div class="hop"><div class="hop-title"><strong>{chain?`第 ${index+1} 跳`:'入口服务器'}</strong>{#if chain&&hops.length>2}<button class="button small danger" disabled={busy} aria-label={`移除第 ${index+1} 跳`} onclick={()=>hops=hops.filter((_,i)=>i!==index)}><Icon name="trash"/></button>{/if}</div><div class="form-grid"><label class="field">服务器<AppSelect bind:value={hop.serverId} disabled={busy} options={serverChoices} aria-label={`第 ${index+1} 跳服务器`}/></label><label class="field">监听地址<input bind:value={hop.listen} disabled={busy} aria-label={`第 ${index+1} 跳监听地址`} placeholder="0.0.0.0:8443"/></label></div></div>{/each}</div>
  {#if chain}<button class="button small" disabled={busy||hops.length>=8} onclick={()=>hops=[...hops,{serverId:'',listen:'0.0.0.0:8443'}]}><Icon name="plus"/>添加跳点</button>{/if}
  <label class="field space-top">最终目标地址<input bind:value={target} disabled={busy} placeholder="目标主机:端口"/></label>
  {#if chain}<p class="hint space-top">按入口到终点排列，使用各服务器的对外地址连接下一跳；下游成功监听后才开放上一跳。</p>{/if}
  <div class="modal-actions"><button class="button" disabled={busy} onclick={()=>save(false)}>仅保存</button><button class="button primary" disabled={busy} onclick={()=>save(true)}>{busy?'提交中…':'保存并应用'}</button></div>
 {:else if view==='delete'&&selected}
  <div class="delete-notice"><h3>删除 {selected.name}？</h3><p>{route(selected)}</p><p>将停止这条隧道的转发，等待 Agent 确认后删除配置。操作失败时会保留记录，便于核对和重试。</p></div>
  <div class="modal-actions"><button class="button" disabled={busy} onclick={()=>{view='list';error='';}}>取消</button><button class="button danger" disabled={busy} onclick={remove}>{busy?'正在停用…':'停用并删除'}</button></div>
 {:else}
  <div class="tunnel-toolbar"><span class="muted">共 {rows.length} 条 tunnel</span><div class="actions"><button class="button small" disabled={busy||!!probing} onclick={()=>start(true)}><Icon name="route"/>链式转发</button><button class="button small" disabled={busy||!!probing} onclick={()=>start(false)}><Icon name="network"/>端口转发</button></div></div>
  <div class="tunnel-list" aria-label="隧道列表">{#each rows as row (row.id)}<article class="tunnel-row"><div class="tunnel-main"><code class="tunnel-name">{row.name}</code><div class="tunnel-route"><span>{route(row)}</span><small class="tag">{protocols(row)}</small></div>{#if row.rules?.length>1&&new Set(row.rules.map((rule:any)=>rule.listen+' → '+rule.target)).size>1}<small class="muted">包含 {row.rules.length} 条规则</small>{/if}</div><div class="actions"><button class="button" title="应用配置" aria-label={`应用隧道 ${row.name}`} disabled={busy||!!probing} onclick={()=>apply(row)}><Icon name="play" size={18}/></button><button class="button probe" title="延迟探测（逐跳）" aria-label={`延迟探测 ${row.name}`} disabled={busy||!!probing} onclick={()=>probe(row)}><Icon name="activity" size={19}/></button><button class="button danger" title="删除隧道" aria-label={`删除隧道 ${row.name}`} disabled={busy||!!probing} onclick={()=>{selected=row;view='delete';error='';}}><Icon name="trash" size={18}/></button></div>{#if probing===row.id}<p class="probe-result" role="status">逐跳探测中…</p>{/if}{#if results[row.id]}<div class="probe-result" aria-live="polite">{#each results[row.id] as item}<div>{item.label}<strong>{item.value}</strong></div>{/each}</div>{/if}</article>{:else}<div class="empty"><Icon name="network" size={28}/><p>暂无隧道</p><small>选择链式转发或端口转发添加配置。</small></div>{/each}</div>
 {/if}
 {#if notice&&view==='list'}<p class="hint space-top" role="status">{notice}</p>{/if}
 {#if taskIds.length}<details class="space-top"><summary>本次操作任务（{taskIds.length}）</summary><div class="actions space-top">{#each taskIds as id}<a class="quiet-link" href={`/tasks?detail=${encodeURIComponent(id)}`}>查看任务 {id.slice(0,8)}</a>{/each}</div></details>{/if}
</Modal>

<style>
 :global(.modal:has(.tunnel-tabs)){width:min(43rem,calc(100vw - 2rem))}:global(.modal:has(.tunnel-tabs) .modal-heading){padding-right:2rem}.tunnel-close{position:absolute;top:1.2rem;right:1.2rem;padding:.3rem}.tunnel-tabs{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin:1.2rem 0}.tunnel-tabs button{padding:.8rem;background:var(--card);border:1px solid var(--border);color:var(--foreground);border-radius:.4rem}.tunnel-tabs button.active{background:var(--primary);color:var(--background);border-color:var(--primary)}.tunnel-toolbar{display:flex;align-items:center;justify-content:space-between;gap:.7rem;margin:1rem 0;font-size:.8rem}.tunnel-list{display:flex;flex-direction:column;gap:.6rem;max-height:48vh;overflow:auto}.tunnel-row{display:flex;align-items:center;flex-wrap:wrap;gap:.65rem;border:1px solid var(--line);padding:.85rem;border-radius:.4rem;background:var(--background)}.tunnel-main{flex:1;min-width:0}.tunnel-name{display:inline-block;max-width:100%;overflow-wrap:anywhere;padding:.25rem .55rem;border:0;background:color-mix(in srgb,var(--primary) 14%,transparent);color:var(--primary);font: .78rem ui-monospace,monospace}.tunnel-route{display:flex;align-items:center;flex-wrap:wrap;gap:.45rem;font-size:.77rem;color:var(--muted);margin-top:.5rem;overflow-wrap:anywhere}.tunnel-row>.actions{gap:.35rem}.tunnel-row>.actions .button{padding:.65rem}.probe-result{flex-basis:100%;font-size:.73rem;border-top:1px solid var(--line);padding-top:.5rem;overflow-wrap:anywhere}.probe-result div+div{margin-top:.4rem}.probe-result strong{display:block;margin-top:.2rem}.hop-list{display:grid;gap:.65rem;margin:1rem 0}.hop{padding:.75rem;border:1px solid var(--line);border-radius:.4rem}.hop-title{display:flex;justify-content:space-between;align-items:center;font-size:.8rem;margin-bottom:.6rem}.delete-notice{font-size:.85rem;line-height:1.7;overflow-wrap:anywhere}.delete-notice p{margin-top:.8rem}details summary{font-size:.75rem;color:var(--muted);cursor:pointer}@media(max-width:520px){.tunnel-toolbar{align-items:flex-start;flex-direction:column}.tunnel-row{padding:.7rem}.tunnel-row>.actions{margin-left:auto}.tunnel-main{flex-basis:100%}}
</style>
