<script lang="ts">
 import AppSelect from "./Select.svelte";
 import {onDestroy} from 'svelte';
 import type {Row} from '../data';
 import {demo,getRow,saveRow,runAction,api,refreshState,errorMessage,toast} from '../store.svelte';
 import {belongsToServer,inboundPreview} from '../server-inbounds';
 import {withRealityFields} from '../reality';
 import {generateRealityShortId} from '../reality-keys';
 import {withManagedFields,managedInboundError,prepareManagedInbound} from '../managed-protocols';
 import ManagedProtocolFields from './ManagedProtocolFields.svelte';
 import Icon from './Icon.svelte';
 import Badge from './Badge.svelte';
 let {server,runtime=[],locked=false,initialInbound='',editing=$bindable(false),working=$bindable(false),onconfig,onchanged}:{server:Row;runtime?:Row[];locked?:boolean;initialInbound?:string;editing?:boolean;working?:boolean;onconfig:()=>void;onchanged:()=>void}=$props();
 let form=$state<Row>({id:''}),mode=$state<'simple'|'expert'>('simple'),keyBusy=$state(false),error=$state(''),notice=$state(''),taskId=$state(''),pending=$state<{kind:'publish'|'delete';row:Row}|null>(null),saved=$state(false),opened=$state('');
 let active=true;onDestroy(()=>{active=false;});
 const rows=$derived((demo.data.inbounds??[]).filter(row=>belongsToServer(row,server)));
 const unmanaged=$derived(runtime.filter(item=>!rows.some(row=>row.tag===item.tag)));
 const allowed=()=>active&&demo.user?.role==='admin';
 const blocked=$derived(working||keyBusy||locked);
 const preview=$derived(JSON.stringify(inboundPreview(form),null,2));
 $effect(()=>{if(initialInbound&&opened!==initialInbound&&rows.some(row=>row.id===initialInbound)){opened=initialInbound;void start(rows.find(row=>row.id===initialInbound));}});
 async function start(row?:Row){
  if(blocked||!allowed())return;working=true;error='';notice='';saved=false;
  try{const value=row?await getRow('inbounds',row.id):{id:crypto.randomUUID(),name:'',tag:`vless-${crypto.randomUUID().slice(0,8)}`,serverId:server.id,server:server.name,protocol:'VLESS',transport:'TCP / Reality',port:443,listen:'0.0.0.0',flow:'xtls-rprx-vision',sniffing:'仅路由',status:'启用',shortIds:generateRealityShortId()};
   if(!allowed())return;if(!belongsToServer(value,server))throw new Error('入站不属于当前服务器');form=withManagedFields(withRealityFields(value));mode='simple';editing=true;
  }catch(cause){if(allowed())error=errorMessage(cause);}finally{working=false;}
 }
 async function save(){
  if(blocked||!allowed())return;error='';
  if(!String(form.name??'').trim()||!String(form.tag??'').trim()){error='请填写入站名称和标签';return;}
  if(!Number.isInteger(form.port)||form.port<1||form.port>65535){error='端口须为 1–65535 的整数';return;}
  if(rows.some(row=>row.id!==form.id&&(Number(row.port)===form.port||row.tag===form.tag))){error='当前服务器已有相同端口或标签的入站';return;}
  if(runtime.some(row=>row.port===form.port&&row.tag!==form.tag&&!rows.some(item=>item.id===form.id&&item.tag===row.tag))){error='当前端口已被服务器配置中的其他入站占用';return;}
  if(form.status!=='停用'){error=managedInboundError(form);if(error)return;}
  working=true;
  try{let value:Row=await prepareManagedInbound({...form,serverId:server.id,server:server.name});if(!allowed())return;
   const result=await saveRow('inbounds',value);if(!allowed())return;form=withRealityFields(result);saved=true;editing=false;notice='入站已保存到主控，尚未发布。点击入站卡片上的“发布”应用到服务器。';toast('入站已保存');
  }catch(cause){if(allowed())error=errorMessage(cause);}finally{working=false;}
 }
 async function execute(){
  if(!pending||blocked||!allowed())return;const operation=pending;working=true;error='';notice='';
  try{const result=operation.kind==='delete'?await api(`/api/collections/inbounds/${encodeURIComponent(operation.row.id)}`,{method:'DELETE'}):await runAction('inbound.config.apply',operation.row.id,'inbounds');
   if(!allowed())return;pending=null;taskId=result.task?.id??'';notice=operation.kind==='delete'?'入站和关联节点已删除，等待服务器应用。':'发布请求已提交，等待服务器应用。';
   if(operation.kind==='delete')await refreshState(true);
   if(taskId){for(let i=0;i<60&&allowed();i++){const task=await getRow('tasks',taskId);if(!allowed())return;if(['成功','success','succeeded'].includes(task.status)){notice=operation.kind==='delete'?'入站已删除，服务器配置已更新。':'入站配置已在服务器生效。';onchanged();return;}if(['失败','不支持','结果未明','failed','unsupported','unknown','superseded','已撤回'].includes(task.status))throw new Error(task.error??'任务未成功，请查看任务结果');await new Promise(resolve=>setTimeout(resolve,1000));}notice='任务仍在处理中，可通过下方链接查看结果。';}
  }catch(cause){if(allowed())error=errorMessage(cause);}finally{working=false;}
 }
</script>

<section class="server-inbounds" aria-label={`${server.name} 的入站管理`}>
 {#if locked}<p class="hint">完整配置有未保存修改，请先保存或放弃修改，再管理入站。</p>{/if}
 {#if error}<p class="error" role="alert">{error}</p>{/if}
 {#if notice}<p class="hint" role="status">{notice}</p>{/if}
 {#if taskId}<a class="quiet-link" href={`/tasks?detail=${encodeURIComponent(taskId)}`}>查看入站任务</a>{/if}
 {#if editing}
  <div class="inbound-heading"><div><h3>{rows.some(row=>row.id===form.id)?'查看 / 编辑入站':'添加入站 · 向导模式'}</h3><p class="muted">{server.name} · 配置只保存到当前服务器</p></div><button class="button small" disabled={blocked} onclick={()=>{editing=false;error='';}}>取消并返回</button></div>
  <div class="mode-switch" aria-label="入站配置模式"><button class:active={mode==='simple'} onclick={()=>mode='simple'}>简易模式</button><button class:active={mode==='expert'} onclick={()=>mode='expert'}>专家模式</button></div>
  <form onsubmit={event=>{event.preventDefault();void save();}}>
   <div class="wizard-grid"><fieldset disabled={blocked}>
    <div class="form-grid"><label class="field">入站名称 *<input bind:value={form.name} required placeholder="例如：香港 · 主入口"/></label><label class="field">端口 *<input type="number" min="1" max="65535" step="1" bind:value={form.port} required/></label><label class="field">状态<AppSelect aria-label="入站状态" bind:value={form.status} options={['启用','停用']}/></label>
    {#if mode==='expert'}<label class="field">入站标签 *<input bind:value={form.tag} required/></label><label class="field">监听地址<input bind:value={form.listen} placeholder="0.0.0.0"/></label><label class="field">流量嗅探<AppSelect aria-label="流量嗅探" bind:value={form.sniffing} options={['关闭','仅路由','启用']}/></label>{/if}</div>
    <ManagedProtocolFields bind:form {server} bind:busy={keyBusy}/>
   </fieldset><aside class="preview"><h4>JSON 预览</h4><p>入站结构预览，私钥已隐藏。clients 在发布时按有效订阅生成，此处不包含用户凭据。</p><pre aria-label="入站 JSON 预览">{preview}</pre></aside></div>
   <div class="wizard-actions"><button type="button" class="button" disabled={blocked} onclick={()=>{editing=false;error='';}}>取消</button><button class="button primary" disabled={blocked} type="submit">{working?'保存中…':'保存入站'}</button></div>
  </form>
 {:else}
  <div class="inbound-heading"><h3>{server.name} 的入站配置 <small>（共 {rows.length} 个）</small></h3><button class="button primary" disabled={blocked} onclick={()=>start()}><Icon name="plus" size={15}/>添加入站</button></div>
  <p class="hint">入站与节点联动管理：删除入站会同时删除关联节点；删除受管节点也会删除对应入站。</p>
  {#if pending}<div class="confirmation" role="alert"><h4>{pending.kind==='delete'?`删除入站“${pending.row.name}”？`:`发布“${pending.row.name}”所在服务器的配置？`}</h4><p>{pending.kind==='delete'?'对应节点和入站将一起删除。':''}此操作会根据主控记录重新生成此服务器的完整 Xray 配置并重启服务。直接编辑的配置请先同步至主控设置。{unmanaged.length?` 当前快照有 ${unmanaged.length} 个非托管入站，重新生成后将被移除。`:''}</p><div class="actions"><button class="button small" disabled={blocked} onclick={()=>pending=null}>取消</button><button class="button small" class:danger={pending.kind==='delete'} disabled={blocked} onclick={execute}>{pending.kind==='delete'?'确认删除并更新服务器':'确认发布并重启'}</button></div></div>{/if}
  <div class="inbound-grid">{#each rows as row (row.id)}{@const actual=runtime.find(item=>item.tag===row.tag)}<article class="inbound-card" aria-label={`入站 ${row.name}`}><div class="card-heading"><div><h4>{row.name}</h4><small>{row.tag}</small></div><span class="protocol">{row.protocol}</span></div><dl><div><dt>端口</dt><dd>{row.port}</dd></div><div><dt>用户数 <small>（配置快照）</small></dt><dd>{Array.isArray(actual?.settings?.clients)?actual.settings.clients.length:'—'}</dd></div><div><dt>状态</dt><dd><Badge value={row.status??'启用'}/></dd></div></dl><div class="actions"><button class="button small" disabled={blocked} onclick={()=>start(row)}><Icon name="eye" size={14}/>查看</button><button class="button small" disabled={blocked} onclick={()=>{pending={kind:'publish',row};error='';}}>发布</button><button class="button small danger" disabled={blocked} onclick={()=>{pending={kind:'delete',row};error='';}}><Icon name="trash" size={14}/>删除</button></div></article>{:else}<div class="empty">此服务器暂无托管入站，点击“添加入站”开始配置。</div>{/each}</div>
  {#if unmanaged.length}<div class="runtime-note"><strong>配置快照中的其他入站（{unmanaged.length}）</strong><p>{unmanaged.map(row=>`${row.tag||row.protocol} : ${row.port??'—'}`).join('、')}</p><button class="button small" onclick={onconfig}>在完整配置中查看</button></div>{/if}
 {/if}
</section>

<style>
 .server-inbounds{min-height:360px;display:grid;gap:16px}.inbound-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.inbound-heading h3{font-size:14px}.inbound-heading p,.inbound-heading small{font-size:12px;color:var(--muted);font-weight:400}.inbound-heading p{margin-top:6px}.inbound-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-content:start}.inbound-card{border:1px solid var(--line);border-radius:8px;padding:20px;background:var(--card);min-width:0}.card-heading{display:flex;justify-content:space-between;align-items:start;gap:12px}.card-heading h4{font-size:14px;overflow-wrap:anywhere}.card-heading small{font-size:11px;color:var(--muted);overflow-wrap:anywhere}.protocol{color:var(--primary);background:color-mix(in srgb,var(--primary) 10%,transparent);border:1px solid color-mix(in srgb,var(--primary) 25%,transparent);padding:5px 10px;border-radius:5px;font-size:11px}dl{margin:20px 0;display:grid;gap:12px}dl div{display:flex;justify-content:space-between;gap:10px;font-size:12px}dt{color:var(--muted)}dd{margin:0}dt small{font-size:10px}.hint{font-size:12px;margin:0}.actions{flex-wrap:wrap}.mode-switch{display:flex;border:1px solid var(--line);padding:4px;border-radius:8px;background:var(--nested)}.mode-switch button{flex:1;background:transparent;border:0;border-radius:5px;padding:10px;color:var(--muted)}.mode-switch .active{color:var(--foreground);background:var(--card)}.wizard-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(240px,1fr);gap:20px}fieldset{border:1px solid var(--line);border-radius:8px;padding:20px;min-width:0}.preview{background:var(--nested);border:1px solid var(--line);border-radius:8px;padding:18px;min-width:0}.preview h4{font-size:13px}.preview p,.runtime-note p,.confirmation p{font-size:12px;color:var(--muted);line-height:1.7;margin:8px 0 12px}.preview pre{font-size:11px;line-height:1.7;overflow:auto;max-height:650px}.wizard-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.confirmation,.runtime-note{padding:16px;border:1px solid var(--line);border-radius:8px;background:var(--nested)}.confirmation h4{font-size:14px}.error{font-size:12px}.quiet-link{font-size:12px}.empty{grid-column:1/-1;min-height:200px}.runtime-note{font-size:12px;overflow-wrap:anywhere}
 @media(max-width:1100px){.inbound-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.inbound-grid,.wizard-grid{grid-template-columns:1fr}.inbound-heading{align-items:start}.inbound-heading h3{line-height:1.7}.inbound-heading .button{flex-shrink:0}.preview pre{max-height:320px}fieldset{padding:14px}}
</style>
