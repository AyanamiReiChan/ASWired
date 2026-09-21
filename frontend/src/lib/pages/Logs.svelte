<script lang="ts">
 import {onMount,onDestroy,tick,untrack} from 'svelte';
 import {demo,errorMessage} from '../store.svelte';import Icon from '../components/Icon.svelte';import AppSelect from '../components/Select.svelte';import LogFiles from '../components/LogFiles.svelte';import SecurityLogs from '../components/SecurityLogs.svelte';
 import {readLogFiles,formatFileLine,parseFileLine,type LogSnapshot,type LogScope} from '../file-logs';
 type Tab='system'|'agent'|'schedule'|'security';
 const tabs:[Tab,string][]=[['system','系统日志'],['agent','Agent 日志'],['schedule','定时任务'],['security','安全日志']];
 let category=$state<Tab>('system'),serverId=$state(''),agentStream=$state('agent'),limit=$state('100'),automatic=$state(true),busy=$state(false),error=$state(''),snapshot=$state<LogSnapshot|null>(null),updated=$state(''),taskName=$state(''),status=$state(''),securityRevision=$state(0),viewport=$state<HTMLPreElement>();
 let mounted=false,disposed=false,generation=0,request:AbortController|undefined;
 const servers=$derived(demo.data.servers??[]);
 const scope=$derived<LogScope>({stream:category==='agent'?agentStream:category,...(category==='agent'?{serverId}: {})});
 const scopeKey=$derived(`${category}:${serverId}:${agentStream}:${limit}`);
 $effect(()=>{if(category==='agent'&&!serverId&&servers.length)serverId=servers[0].id;});
 $effect(()=>{const key=scopeKey;if(mounted){untrack(()=>{void refresh(true);});}});
 onMount(()=>{mounted=true;void refresh(true);const timer=setInterval(()=>{if(category!=='agent'&&automatic&&!busy)void refresh();},5000);return()=>clearInterval(timer);});
 onDestroy(()=>{disposed=true;generation++;request?.abort();});
 async function refresh(reset=false,manual=false){
  if(reset){generation++;request?.abort();request=undefined;busy=false;snapshot=null;error='';updated='';}else if(busy)return;
  if(category==='agent'&&!manual)return;
  const id=++generation,selected={...scope},key=scopeKey,user=demo.user?.id;
  if(category==='agent'&&!serverId){busy=false;return;}busy=true;
  const pending=new AbortController();request=pending;
  const scrollBottom=!viewport||viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<45;
  try{const result=await readLogFiles(selected,Number(limit),pending.signal);if(disposed||id!==generation||key!==scopeKey||user!==demo.user?.id)return;snapshot=result;error='';updated=new Date().toLocaleTimeString('zh-CN',{hour12:false});securityRevision++;await tick();if(scrollBottom&&viewport)viewport.scrollTop=viewport.scrollHeight;}
  catch(e){if(!disposed&&id===generation){snapshot=null;updated='';error=errorMessage(e);}}finally{if(id===generation){busy=false;request=undefined;}}
 }
 function afterClear(result?:LogSnapshot){
  if(category!=='agent'){void refresh(true);return;}
  generation++;request?.abort();request=undefined;busy=false;snapshot=result??null;error='';updated=result?new Date().toLocaleTimeString('zh-CN',{hour12:false}):'';
 }
 const rows=$derived((snapshot?.lines??[]).map(parseFileLine));
 const tasks=$derived(rows.filter(row=>row.startedAt&&row.status));
 const taskNames=$derived([...new Set(tasks.map(row=>String(row.name??row.event??'')))]);
 const filteredTasks=$derived(tasks.filter(row=>(!taskName||(row.name??row.event)===taskName)&&(!status||row.status===status)));
 const text=$derived([...(snapshot?.lines??[])].reverse().map(formatFileLine).join('\n'));
 const labels:Record<string,string>={success:'成功',failed:'失败',completed:'已完成',running:'执行中',queued:'等待中',unknown:'结果未明'};
 function at(value:string){return value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'—';}
 function details(row:Record<string,any>){return row.message||(row.details?JSON.stringify(row.details):'—');}
</script>
<div class="page-head"><div><div class="eyebrow">运维 / 日志管理</div><h1>日志管理</h1><p>系统日志、Agent 日志、定时任务与安全日志的集中查看。</p></div>{#if category!=='agent'}<label class="auto-toggle"><input type="checkbox" role="switch" bind:checked={automatic}/><span>自动刷新</span></label>{/if}</div>
<nav class="log-tabs" aria-label="日志分类">{#each tabs as [key,label]}<button class:active={category===key} aria-pressed={category===key} onclick={()=>{category=key;taskName='';status='';}}>{label}</button>{/each}</nav>
<section class="card log-panel" aria-label={tabs.find(([key])=>key===category)?.[1]}>
 {#if category==='security'}<SecurityLogs events={rows} revision={securityRevision} onRefresh={()=>refresh()}/>{:else}
 <div class="log-toolbar">
  {#if category==='agent'}<div class="server-select"><AppSelect aria-label="日志服务器" bind:value={serverId} options={servers.map(row=>({value:row.id,label:String(row.name??row.id)}))}/></div><div class="type-select"><AppSelect aria-label="日志类型" bind:value={agentStream} options={[{value:'agent',label:'Agent'},{value:'xray-access',label:'Xray 访问'},{value:'xray-error',label:'Xray 错误'}]}/></div>{/if}
  {#if category==='schedule'}<div class="server-select"><AppSelect aria-label="任务筛选" bind:value={taskName} options={[{value:'',label:'全部任务'},...taskNames.map(value=>({value,label:value}))]}/></div><div class="type-select"><AppSelect aria-label="状态筛选" bind:value={status} options={[{value:'',label:'全部状态'},...Object.entries(labels).map(([value,label])=>({value,label}))]}/></div>{/if}
  <div class="line-select"><AppSelect aria-label="日志行数" bind:value={limit} options={['100','200','500','1000','2000'].map(value=>({value,label:`${value} 行`}))}/></div><button class="button" aria-label={category==='agent'?'同步日志':'刷新日志'} disabled={busy||(category==='agent'&&!serverId)} onclick={()=>refresh(false,true)}><Icon name="refresh" size={16}/>{category==='agent'?(busy?'同步中…':'同步日志'):(busy?'读取中…':'')}</button>
 </div>
 {#if category==='schedule'}<div class="table-scroll"><table aria-label="定时任务执行记录"><thead><tr><th>任务</th><th>开始时间</th><th>耗时</th><th>状态</th><th>详情</th></tr></thead><tbody>{#each filteredTasks as row(row.key)}<tr><td>{row.name??row.event}</td><td class="nowrap" title={row.startedAt}>{at(row.startedAt)}</td><td>{row.durationMs??0}ms</td><td><span class:failed={row.status==='failed'} class="status">{labels[row.status]??row.status}</span></td><td class="detail" title={details(row)}>{details(row)}</td></tr>{:else}<tr><td colspan="5" class="empty-row">{busy?'正在读取执行记录…':'暂无匹配的定时任务记录'}</td></tr>{/each}</tbody></table></div>
 {:else}<pre class="text-console" bind:this={viewport} aria-label="日志文本">{text||(busy?'正在读取日志文件…':category==='agent'&&!serverId?'请先添加服务器':category==='agent'&&!snapshot?'点击“同步日志”读取所选服务器的日志文件':'日志文件暂无内容')}</pre>{/if}
 {/if}
 {#if error}<p class="error" role="alert">{error}</p>{/if}
 <div class="log-summary"><span>{category==='agent'?'仅手动同步':automatic?'自动刷新已开启':'自动刷新已暂停'}{updated?` · ${category==='agent'?'最近同步':'最近更新'} ${updated}`:''}</span><span>{snapshot?.lines.length??0} 条{snapshot?.truncated?' · 仅显示最近部分记录':''}</span></div>
 {#if category!=='agent'||serverId}{#key scopeKey}<LogFiles inventory={snapshot?.inventory??null} {scope} {busy} limit={Number(limit)} onRefresh={()=>refresh(false,true)} onCleared={afterClear}/>{/key}{/if}
</section>
<style>
 .log-toolbar :global(.app-select-trigger){width:100%;min-width:0;border-color:var(--border);height:36px}.auto-toggle input{appearance:none;width:34px;height:19px;min-height:0;padding:2px;margin:0;border:1px solid var(--border);border-radius:20px;background:var(--nested);cursor:pointer}.auto-toggle input:before{content:'';display:block;width:13px;height:13px;border-radius:50%;background:var(--muted);transition:transform .15s}.auto-toggle input:checked{background:var(--primary)}.auto-toggle input:checked:before{transform:translateX(14px);background:white}
 .auto-toggle{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--muted);white-space:nowrap}.auto-toggle input{accent-color:var(--primary)}.log-tabs{display:flex;background:var(--nested);border:1px solid var(--line);padding:4px;margin-bottom:24px;gap:4px}.log-tabs button{flex:1;border:0;padding:10px;background:transparent;color:var(--muted);white-space:nowrap;font-size:13px}.log-tabs button.active{background:var(--card);color:var(--foreground);box-shadow:0 1px 4px #0001}.log-panel{padding:22px}.log-toolbar{display:flex;align-items:center;gap:8px;margin:0 0 14px;flex-wrap:wrap}.server-select{width:230px}.type-select{width:150px}.line-select{width:110px}.text-console{height:60vh;min-height:350px;max-height:850px;overflow:auto;white-space:pre;overscroll-behavior:contain;border:1px solid var(--border);background:var(--background);padding:14px;margin:0;font:11px/1.9 ui-monospace,Consolas,monospace;color:var(--foreground);tab-size:2}.table-scroll{border:1px solid var(--border);max-height:65vh;min-height:350px;overflow:auto}table{border-collapse:collapse;width:100%;font-size:12px;min-width:760px}th,td{padding:10px 13px;text-align:left;border-bottom:1px solid var(--line)}th{position:sticky;top:0;background:var(--nested);font-weight:500;color:var(--muted);z-index:1}td{vertical-align:top}.nowrap{white-space:nowrap}.detail{max-width:500px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)}.status{font-size:11px;background:color-mix(in srgb,var(--primary) 12%,transparent);padding:3px 7px;color:var(--primary);white-space:nowrap}.status.failed{color:var(--danger);background:color-mix(in srgb,var(--danger) 10%,transparent)}.empty-row{text-align:center;color:var(--muted);padding:55px}.log-summary{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--muted);font-size:10px;margin-top:12px}@media(max-width:700px){.log-panel{padding:12px}.log-tabs{gap:0}.log-tabs button{padding:9px 5px;font-size:12px}.server-select{width:100%}.text-console{height:55vh}.type-select{flex:1}}
</style>
