<script lang="ts">
 import {Dialog} from 'bits-ui';
 import {onMount,onDestroy,untrack} from 'svelte';
 import Icon from './Icon.svelte';
 import ServerInbounds from './ServerInbounds.svelte';
 import XrayOutbounds from './XrayOutbounds.svelte';
 import XrayRouting from './XrayRouting.svelte';
 import {graphError} from '../xray-workbench';
 import type {Row} from '../data';
 import {demo,runAction,getRow,errorMessage,toast,api} from '../store.svelte';
 import {parseConfigDraft,mergeConfigDraft,sectionDraft,type ConfigSection} from '../xray-config';
 let {server,onclose,initialSection='config',initialInbound='',routingScope=''}: {server:Row;onclose:()=>void;initialSection?:ConfigSection;initialInbound?:string;routingScope?:string}=$props();
 let open=$state(true),section=$state<ConfigSection>(untrack(()=>initialSection)),draft=$state(''),config=$state<Record<string,any>>({}),baseline=$state('');
 let inboundEditing=$state(false),inboundWorking=$state(false),sectionEditing=$state(false);
 $effect(()=>{if(!sectionEditing&&error.startsWith('请先采用修改或取消当前条目编辑'))error='';});
 $effect(()=>{if(!inboundEditing&&!inboundWorking&&error.startsWith('请先保存或取消入站编辑'))error='';});
 let busy=$state(false),loaded=$state(false),error=$state(''),taskId=$state(''),core=$state<Record<string,any>|null>(null),statusError=$state('');
 let syncedAt=$state(''),cacheNotice=$state(''),cacheLoading=$state(false),cacheRequest=0;
 let disposed=false;onDestroy(()=>disposed=true);
 const tabs:[ConfigSection,string][]=[['config','配置管理'],['inbounds','入站管理'],['outbounds','出站管理'],['routing','路由管理']];
 const online=$derived(['在线','告警'].includes((demo.data.servers??[]).find(row=>row.id===server.id)?.status??server.status));
 const validation=$derived.by(()=>{if(!draft.trim())return '';try{parseConfigDraft(draft,section);return '';}catch(cause){return errorMessage(cause);}});
 const current=$derived.by(()=>{try{return mergeConfigDraft(config,draft,section);}catch{return null;}});
 const dirty=$derived(loaded&&(!current||JSON.stringify(current)!==baseline));
 function updateVisual(value:Record<string,any>){if(busy||!authorized())return;config=value;draft=sectionDraft(value,section);error='';}
 const authorized=()=>!disposed&&demo.user?.role==='admin';
 async function request(action:string,params:Record<string,any>={}){
  if(!authorized())throw new Error('当前会话无管理权限');
  const result=await runAction(action,server.id,'servers',params);
  if(!authorized())throw new Error('窗口已关闭或权限已变更');
  const id=result.task?.id;
  if(!id)return result;
  taskId=id;
  for(let attempt=0;attempt<60&&authorized();attempt++){
   const task=await getRow('tasks',id);
   if(!authorized())throw new Error('窗口已关闭或权限已变更');
   if(['成功','success','succeeded'].includes(task.status))return task.result?.data??task.result??{};
   if(['失败','不支持','结果未明','failed','unsupported','unknown','superseded','已撤回'].includes(task.status))throw new Error(task.error??'Agent 未完成请求，请查看任务结果');
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw new Error('仍在等待 Agent，可在任务页面查看执行结果');
 }
 async function readStatus(){try{const value=await request('core.status');if(authorized()){core=value;statusError='';}}catch(cause){if(authorized())statusError=errorMessage(cause);}}
 async function loadCache(){
  if(!authorized()||busy||inboundWorking||cacheLoading)return;
  cacheLoading=true;const generation=cacheRequest;
  try{const value=await api(`/api/servers/${encodeURIComponent(server.id)}/xray-cache`);
   if(!authorized()||busy||generation!==cacheRequest)return;
   core=value.core??core;statusError='';
   cacheNotice=value.lastError??(value.refreshPending?'配置已变更，后台正在同步最新快照':'');
   if(value.config&&typeof value.config==='object'&&!Array.isArray(value.config)&&!value.refreshPending){
    if(dirty||sectionEditing){if(value.syncedAt!==syncedAt)cacheNotice='后台已有更新；当前未保存的编辑已保留。';return;}
    if(!loaded||value.syncedAt!==syncedAt){config=value.config;baseline=JSON.stringify(config);draft=sectionDraft(config,section);loaded=true;syncedAt=value.syncedAt??'';}
   }else if(!loaded&&value.config){config=value.config;baseline=JSON.stringify(config);draft=sectionDraft(config,section);loaded=true;syncedAt=value.syncedAt??'';}
  }catch(cause){if(authorized())cacheNotice=`缓存读取失败：${errorMessage(cause)}`;}finally{cacheLoading=false;}
 }
 async function load(){
  if(busy||!authorized()||dirty)return;cacheRequest++;busy=true;error='';
  try{const value=await request('core.config.get');if(!value.config||Array.isArray(value.config)||typeof value.config!=='object')throw new Error('Agent 未返回有效配置');
   if(!authorized())return;config=value.config;baseline=JSON.stringify(config);draft=sectionDraft(config,section);loaded=true;
  }catch(cause){if(authorized())error=errorMessage(cause);}
  finally{if(authorized()){busy=false;await loadCache();}}
 }
 function switchSection(next:ConfigSection){if(next===section)return;if(sectionEditing){error='请先采用修改或取消当前条目编辑，再切换页签。';return;}if(inboundWorking||inboundEditing){error='请先保存或取消入站编辑，再切换页签。';return;}if(draft.trim()){try{config=mergeConfigDraft(config,draft,section);}catch{error='请先修正当前 JSON，再切换页签';return;}}section=next;if(loaded)draft=sectionDraft(config,next);error='';}
 function format(){try{draft=JSON.stringify(parseConfigDraft(draft,section),null,2);error='';}catch(cause){error=errorMessage(cause);}}
 async function control(action:string){if(busy||inboundWorking||inboundEditing||sectionEditing||!authorized())return;busy=true;error='';try{const result=await request(action);if(authorized()){core=result;statusError='';toast('Xray 服务操作已完成');}}catch(cause){if(authorized()){error=errorMessage(cause);core=null;}}finally{busy=false;}}
 async function save(){
  if(busy||sectionEditing||!authorized()||!loaded||!current)return;const target=current;const invalid=graphError(target);if(invalid){error=invalid;return;}cacheRequest++;busy=true;error='';
  try{await request('core.config.apply',{config:target});if(!authorized())return;config=target;baseline=JSON.stringify(target);draft=sectionDraft(target,section);toast('配置已通过 Agent 校验并应用');await readStatus();}
  catch(cause){if(authorized())error=errorMessage(cause);}finally{busy=false;}
 }
 function close(){if(busy){error='正在等待 Agent 完成操作，请稍后关闭。';return;}if(sectionEditing){error='请先采用修改或取消当前条目编辑，再关闭窗口。';return;}if(inboundWorking||inboundEditing){error='请先保存或取消入站编辑，等待当前操作完成后关闭。';return;}if(dirty){error='存在未保存修改；请保存配置，或点击“放弃修改并关闭”。';return;}open=false;onclose();}
 onMount(()=>{void loadCache();const timer=window.setInterval(()=>void loadCache(),15000);return ()=>window.clearInterval(timer);});
</script>

<Dialog.Root {open} onOpenChange={value=>{if(!value)close();}}><Dialog.Portal><Dialog.Overlay class="modal-overlay"/><Dialog.Content class="modal xray-manager">
 <div class="manager-heading"><div><Dialog.Title class="modal-title">Xray 管理 · {server.name}</Dialog.Title><Dialog.Description class="muted">管理此服务器的 Xray 服务、完整配置、入站、出站和路由。</Dialog.Description></div><button class="icon-button" aria-label="关闭 Xray 管理" onclick={close}><Icon name="x" size={20}/></button></div>
 <div class="manager-tabs" role="tablist" aria-label="Xray 管理分类">{#each tabs as [key,label]}<button role="tab" id={`xray-tab-${key}`} aria-selected={section===key} aria-controls="xray-panel" tabindex={section===key?0:-1} class:active={section===key} disabled={busy} onclick={()=>switchSection(key)} onkeydown={event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();const index=tabs.findIndex(([id])=>id===section);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;switchSection(tabs[next][0]);if(section===tabs[next][0])document.getElementById(`xray-tab-${section}`)?.focus();}}}>{label}</button>{/each}</div>
 <div class="service-bar"><span class="muted">服务控制</span><div class="service-actions">{#each [['core.start','play','启动'],['core.stop','pause','停止'],['core.restart','refresh','重启']] as [action,icon,label]}<button class="button small" disabled={busy||sectionEditing||inboundWorking||inboundEditing||!online||(action==='core.start'&&core?.running===true)||(action==='core.stop'&&core?.running===false)} onclick={()=>control(action)}><Icon name={icon} size={14}/>{label}</button>{/each}</div><span class="core-status" class:running={online&&core?.running===true}>{!online?'Agent 离线':core?.running===true?'运行中':core?.running===false?'已停止':'状态待确认'} · Xray {core?.core_version??server.core??'未上报'}</span><div class="config-badges"><span>内嵌控制</span>{#if loaded}<span>流量统计 {current?.stats!=null?'已配置':'未配置'}</span><span>指标统计 {current?.metrics!=null?'已配置':'未配置'}</span>{/if}</div></div>
 {#if statusError}<p class="hint">服务状态读取失败：{statusError}</p>{/if}
 <div class="cache-summary"><span>{syncedAt?`主控缓存 · 最近同步 ${new Date(syncedAt).toLocaleString('zh-CN',{hour12:false})}`:cacheLoading?'正在读取主控缓存…':'暂无缓存，等待 Agent 首次同步'}</span><span>后台每 5 分钟同步</span></div>
 {#if cacheNotice}<p class="hint">{cacheNotice}</p>{/if}
 <div id="xray-panel" role="tabpanel" aria-labelledby={`xray-tab-${section}`} tabindex="0">
  {#if section==='inbounds'}
   <ServerInbounds {server} {initialInbound} runtime={Array.isArray(config.inbounds)?config.inbounds:[]} locked={dirty||busy} bind:editing={inboundEditing} bind:working={inboundWorking} onconfig={()=>switchSection('config')} onchanged={()=>{syncedAt='';void loadCache();}}/>
  {:else if section==='outbounds'&&loaded}
   <XrayOutbounds {config} disabled={busy} bind:editing={sectionEditing} onchange={updateVisual}/>
  {:else if section==='routing'&&loaded}
   <XrayRouting {config} scope={routingScope} disabled={busy} bind:editing={sectionEditing} onchange={updateVisual}/>
  {:else}
  <div class="editor-heading"><span>{section==='config'?'完整 Xray JSON':section==='outbounds'?'出站配置 · outbounds':'路由配置 · routing'}{#if dirty}<small>有未保存修改</small>{/if}</span><button class="button small" disabled={busy||dirty||!online} onclick={load}><Icon name="refresh" size={13}/>{busy?'处理中…':'立即同步 Agent'}</button></div>
  <textarea class="code-editor xray-editor" aria-label={section==='config'?'完整 Xray 配置':`${tabs.find(([key])=>key===section)?.[1]} JSON`} bind:value={draft} disabled={busy||!loaded} spellcheck="false" wrap="off" placeholder={busy?'正在同步 Agent 配置…':cacheLoading?'正在读取主控缓存…':'尚无配置快照，后台同步后会自动显示'}></textarea>
  <div class="editor-status"><span class:valid={loaded&&!validation} class:error={!!validation}>{loaded?(validation||'✓ JSON 格式正确'):'尚未加载配置'}{#if loaded&&!validation}<small> · 保存时由 Agent 校验 Xray 配置</small>{/if}</span><button class="button small" disabled={busy||!loaded||!!validation} onclick={format}>格式化</button></div>
  {/if}
 </div>
 {#if error}<p class="error" role="alert">{error}</p>{/if}
 <div class="manager-footer"><div><p class="hint">{section==='inbounds'?'入站保存在主控，发布与删除的生效状态以 Agent 任务结果为准。':'保存将应用完整配置并重启 Xray。托管入站发布会按主控记录重新生成完整配置。'}</p>{#if taskId}<a class="quiet-link task-link" href={`/tasks?detail=${encodeURIComponent(taskId)}`}>查看最近任务</a>{/if}</div><div class="actions">{#if dirty}<button class="button" disabled={busy||sectionEditing||inboundWorking||inboundEditing} onclick={()=>{open=false;onclose();}}>放弃修改并关闭</button>{:else}<button class="button" onclick={close}>关闭</button>{/if}{#if section!=='inbounds'}<button class="button primary" disabled={busy||sectionEditing||!online||!loaded||!!validation||!draft.trim()||!dirty} onclick={save}>{busy?'处理中…':'保存配置并重启'}</button>{/if}</div></div>
</Dialog.Content></Dialog.Portal></Dialog.Root>

<style>
 .cache-summary{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--muted)}
 :global(.modal.xray-manager){width:min(1440px,calc(100vw - 3rem));max-height:94dvh;padding:24px;display:flex;flex-direction:column;gap:16px;overflow:auto}.manager-heading{display:flex;align-items:start;justify-content:space-between;gap:20px}.manager-heading :global(.muted){margin-top:5px;font-size:12px}.manager-heading .icon-button{flex-shrink:0}.manager-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;background:var(--nested);border:1px solid var(--line);padding:4px;border-radius:9px}.manager-tabs button{padding:10px;border:0;border-radius:6px;background:transparent;color:var(--muted);font-size:13px}.manager-tabs button.active{background:var(--card);color:var(--foreground);box-shadow:0 1px 5px #0001}.service-bar{display:flex;align-items:center;flex-wrap:wrap;gap:12px;font-size:12px;padding-bottom:15px;border-bottom:1px solid var(--line)}.service-actions{display:flex;gap:6px}.core-status{padding:6px 9px;border-radius:5px;background:var(--nested);color:var(--muted)}.core-status.running{color:var(--success);background:color-mix(in srgb,var(--success) 12%,transparent)}.config-badges{display:flex;gap:8px;margin-left:auto;color:var(--muted);font-size:11px;flex-wrap:wrap}.config-badges span{padding:4px 7px;border:1px solid var(--line);border-radius:4px}.editor-heading,.editor-status{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;color:var(--muted)}.editor-heading{margin-bottom:10px}.editor-heading small{color:var(--warning);margin-left:10px}.xray-editor{display:block;width:100%;height:clamp(240px,51dvh,720px);min-height:240px;padding:18px;resize:vertical;line-height:1.65;font-size:12px;tab-size:2;background:var(--nested);border:1px solid var(--line);border-radius:8px}.editor-status{margin-top:10px;flex-wrap:wrap}.editor-status .valid{color:var(--success)}.editor-status small{color:var(--muted);font-size:11px}.manager-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;border-top:1px solid var(--line);padding-top:14px}.manager-footer .hint{font-size:11px;margin:0}.manager-footer .actions{flex-wrap:wrap;justify-content:flex-end;flex-shrink:0}.task-link{font-size:11px;display:inline-block;margin-top:5px}#xray-panel{flex-shrink:0;min-width:0}.error{font-size:12px;margin:0}
 @media(max-width:700px){:global(.modal.xray-manager){width:calc(100vw - 1rem);padding:16px;gap:12px}.manager-tabs button{font-size:12px;padding:9px 4px}.manager-footer{align-items:stretch;flex-direction:column}.config-badges{margin-left:0}.manager-footer .actions{justify-content:flex-end}.xray-editor{height:42dvh}}
</style>
