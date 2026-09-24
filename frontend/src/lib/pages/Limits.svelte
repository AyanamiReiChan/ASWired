<script lang="ts">
 import {onMount} from 'svelte';
 import {api,errorMessage} from '../store.svelte';
 import Badge from '../components/Badge.svelte';
 import AppSelect from '../components/Select.svelte';
 import {scopeLabels,statusLabels,rateLabel,durationLabel,timeLabel,ruleTitle,ruleCondition,ruleResult,rulePeriod,triggerCondition,triggerResult,releaseLabel,matchesLimitSearch,type LimitGroup,type LimitTrigger} from '../limits-view';

 let groups=$state<LimitGroup[]>([]),records=$state<LimitTrigger[]>([]);
 let summary=$state({triggerCount:0,userCount:0,activeCount:0,activeUserCount:0});
 let busy=$state(false),loaded=$state(false),error=$state(''),tab=$state('限速规则');
 let search=$state(''),scope=$state('all'),status=$state('all'),currentPage=$state(1),truncated=$state(false),updatedAt=$state('');
 let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
 const pageSize=25;
 const enabledCount=$derived(groups.reduce((count,group)=>count+group.rules.filter(rule=>rule.enabled).length,0));
 const visibleGroups=$derived(groups.filter(group=>scope==='all'||group.scope===scope).map(group=>({...group,rules:group.rules.filter(rule=>matchesLimitSearch(search,group.name,scopeLabels[group.scope],ruleTitle(rule),rule.id,ruleCondition(rule)))})).filter(group=>group.rules.length||matchesLimitSearch(search,group.name,scopeLabels[group.scope])));
 const matchingRecords=$derived(records.filter(row=>(status==='all'||row.status===status)&&matchesLimitSearch(search,row.userName,row.userId,row.serverName,row.serverId,row.sourceName,row.ruleId,ruleTitle({id:row.ruleId,kind:row.type==='quota_triggered'?'quota':'behavior'}))));
 const pageCount=$derived(Math.max(1,Math.ceil(matchingRecords.length/pageSize)));
 const visibleRecords=$derived(matchingRecords.slice((currentPage-1)*pageSize,currentPage*pageSize));
 $effect(()=>{search;status;currentPage=1;});
 $effect(()=>{if(currentPage>pageCount)currentPage=pageCount;});
 function schedule(){if(!stopped)timer=setTimeout(()=>{if(document.visibilityState==='visible')void refresh();else schedule();},30000);}
 async function refresh(){
  if(busy)return;if(timer)clearTimeout(timer);busy=true;error='';
  try{const [catalog,history]=await Promise.all([api('/api/limits/rules'),api('/api/limits/triggers')]);if(!stopped){groups=catalog.groups??[];records=history.rows??[];summary=history.summary??{triggerCount:0,userCount:0,activeCount:0,activeUserCount:0};truncated=history.truncated===true;loaded=true;updatedAt=new Date().toISOString();}}
  catch(cause){if(!stopped)error=errorMessage(cause);}
  finally{busy=false;schedule();}
 }
 function switchTab(value:string){tab=value;search='';currentPage=1;}
 function groupMode(group:LimitGroup){return ({builtin:'内置均衡规则',custom:'自定义行为规则',disabled:'行为限速已关闭',empty:'行为规则为空',inherited:'行为规则继承上级',invalid:'行为配置无效'} as Record<string,string>)[group.mode]||'已有配置';}
 const manageLink=(group:LimitGroup)=>group.scope==='global'?'/settings?section=behavior':group.scope==='plan'?'/plans':'/members';
 const manageLabel=(group:LimitGroup)=>group.scope==='global'?'编辑全局规则':group.scope==='plan'?'管理套餐':'管理用户';
 onMount(()=>{void refresh();return()=>{stopped=true;if(timer)clearTimeout(timer);};});
</script>

<div class="page-head">
 <div><div class="eyebrow">运行状态 / 速度与行为</div><h1>限速管理</h1><p>查看已配置的限速规则，以及实际触发处罚的用户记录。</p></div>
 <div class="actions"><a class="button" href="/settings?section=behavior">配置全局规则</a><button class="button" disabled={busy} onclick={()=>refresh()}>{busy?'刷新中…':'刷新'}</button></div>
</div>
{#if error}<p class="error" role="alert">{error}{loaded?'；当前保留上次加载的数据。':''}</p>{/if}
<div class="limit-summary">
 <div class="card"><span>已启用规则</span><strong>{loaded?enabledCount:'—'}</strong><small>按配置来源统计</small></div>
 <div class="card"><span>处罚期内用户</span><strong>{loaded?summary.activeUserCount:'—'}</strong><small>当前已加载记录，用户去重</small></div>
 <div class="card"><span>触发记录</span><strong>{loaded?summary.triggerCount:'—'}</strong><small>{loaded?`涉及 ${summary.userCount} 位用户`:'等待加载'}</small></div>
</div>
<div class="tabs">{#each ['限速规则','触发用户记录'] as item}<button class:active={tab===item} aria-pressed={tab===item} onclick={()=>switchTab(item)}>{item}</button>{/each}</div>
<div class="limit-toolbar">
 <input class="limit-search" aria-label={tab==='限速规则'?'搜索限速规则':'搜索触发记录'} placeholder={tab==='限速规则'?'搜索规则、套餐或用户':'搜索用户、服务器或规则'} bind:value={search}/>
 <div class="limit-filter">{#if tab==='限速规则'}<AppSelect bind:value={scope} options={[{value:'all',label:'全部来源'},...Object.entries(scopeLabels).map(([value,label])=>({value,label}))]} aria-label="规则来源"/>{:else}<AppSelect bind:value={status} options={[{value:'all',label:'全部状态'},...Object.entries(statusLabels).map(([value,label])=>({value,label}))]} aria-label="处罚状态"/>{/if}</div>
 {#if updatedAt}<small class="muted updated">更新于 {timeLabel(updatedAt)}</small>{/if}
</div>

{#if tab==='限速规则'}
 <p class="hint rule-hint">行为规则按用户、套餐、全局的顺序取用。明确关闭或保存空规则列表会覆盖继承；固定限速和流量用尽策略独立生效。</p>
 <div class="rule-groups">
 {#each visibleGroups as group(group.id)}
  <section class="card no-pad rule-group">
   <div class="group-head"><div><div class="group-title"><span class="scope-label">{scopeLabels[group.scope]}</span><h2>{group.name}</h2></div><p class="hint">{groupMode(group)}{#if group.enabled&&group.maxGapSeconds} · 允许采样间隔 {durationLabel(group.maxGapSeconds)}{/if}</p></div><a class="quiet-link" href={manageLink(group)}>{manageLabel(group)}</a></div>
   {#if group.error}<p class="error group-message">{group.error}</p>{/if}
   {#if group.rules.length}
    <div class="table-scroll"><table class="rules-table"><thead><tr><th>规则</th><th>触发条件 / 适用范围</th><th>下载上限 / 处理</th><th>持续时间</th><th>状态</th></tr></thead><tbody>
    {#each group.rules as rule(`${rule.kind}:${rule.id}`)}<tr><td><div class="cell-stack"><strong>{ruleTitle(rule)}</strong><small class="muted">{rule.id}</small></div></td><td>{ruleCondition(rule)}</td><td>{ruleResult(rule)}</td><td>{rulePeriod(rule)}</td><td><div class="cell-stack"><Badge value={rule.enabled?'已启用':'未启用'} kind={rule.enabled?'success':'neutral'}/>{#if rule.kind==='behavior'&&rule.priority!==undefined}<small class="muted">优先级 {rule.priority}</small>{/if}</div></td></tr>{/each}
    </tbody></table></div>
   {:else}<div class="empty">{search?'没有匹配的规则':group.mode==='disabled'?'此来源已明确关闭行为限速':group.mode==='empty'?'此来源未配置行为规则':'此来源暂无可展示的规则'}</div>{/if}
  </section>
 {:else}<div class="card empty">{!loaded&&busy?'正在加载限速规则…':error&&!loaded?'规则加载失败，请重试。':'没有匹配的规则来源'}</div>{/each}
 </div>
{:else}
 <p class="hint rule-hint">仅显示真实触发的处罚。“处罚期内”表示主控仍保留该处罚，节点执行结果可在<a class="quiet-link" href="/tasks">任务中心</a>查看。</p>
 {#if truncated}<p class="hint history-notice">仅展示最近 1,000 条触发记录，统计与筛选基于当前已加载记录。</p>{/if}
 <section class="card no-pad"><div class="table-scroll"><table class="records-table"><thead><tr><th>用户 / 服务器</th><th>触发规则</th><th>触发时下载</th><th>规则限速 / 处理</th><th>触发时间 / 截止时间</th><th>状态</th></tr></thead><tbody>
 {#each visibleRecords as row(row.id)}
  <tr><td><div class="cell-stack"><strong>{row.userName||row.userId||'已删除用户'}</strong><small class="muted">{row.serverName||row.serverId||(row.type==='quota_triggered'?'套餐范围':'服务器未记录')}</small></div></td>
   <td><div class="cell-stack"><strong>{ruleTitle({id:row.ruleId,kind:row.type==='quota_triggered'?'quota':'behavior'})}</strong><small class="muted">{row.sourceName||'历史来源未记录'}</small><small class="muted">{triggerCondition(row)}</small></div></td>
   <td>{row.type==='quota_triggered'?'不适用':rateLabel(row.sampleMbps)}</td><td>{triggerResult(row)}</td>
   <td><div class="cell-stack"><span>{timeLabel(row.at)}</span><small class="muted">{row.type==='quota_triggered'?'额度恢复后解除':`截止 ${timeLabel(row.until)}`}</small></div></td>
   <td><div class="cell-stack"><Badge value={statusLabels[row.status]||statusLabels.unknown} kind={row.status==='active'?'warning':row.status==='released'?'success':'neutral'}/>{#if row.releasedAt}<small class="muted">{timeLabel(row.releasedAt)}</small>{/if}{#if row.releaseReason}<small class="muted">{releaseLabel(row.releaseReason)}</small>{/if}</div></td></tr>
 {:else}<tr><td colspan="6"><div class="empty">{!loaded&&busy?'正在加载触发记录…':error&&!loaded?'记录加载失败，请重试。':search||status!=='all'?'没有匹配的触发记录':'还没有用户触发限速。未触发的用户不会出现在这里。'}</div></td></tr>{/each}
 </tbody></table></div></section>
 <div class="limit-pagination"><small class="muted">共 {matchingRecords.length} 条 · 第 {currentPage} / {pageCount} 页</small><div class="actions"><button class="button small" disabled={currentPage<=1} onclick={()=>currentPage--}>上一页</button><button class="button small" disabled={currentPage>=pageCount} onclick={()=>currentPage++}>下一页</button></div></div>
{/if}
<p class="hint space-top">页面可见时每 30 秒刷新。时间按浏览器所在时区显示。此页面仅管理员可用。</p>

<style>
 .page-head{align-items:flex-start}.page-head>.actions{flex-shrink:0;flex-wrap:wrap}
 .limit-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:26px}
 .limit-summary .card{display:flex;flex-direction:column;gap:10px;padding:20px 24px}.limit-summary span,.limit-summary small{color:var(--muted)}.limit-summary span{font-size:12px}.limit-summary strong{font-size:28px;font-weight:600}.limit-summary small{font-size:11px}
 .limit-toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:20px 0 14px}.limit-search{flex:1;max-width:420px;min-width:220px}.limit-filter{width:160px}.updated{margin-left:auto;font-size:11px}
 .rule-hint{margin-bottom:18px;line-height:1.7}.rule-hint a{margin:0 4px}.rule-groups{display:grid;gap:20px}.group-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 24px;border-bottom:1px solid var(--line)}.group-title{display:flex;align-items:center;gap:10px;margin-bottom:8px}.group-title h2{font-size:16px;overflow-wrap:anywhere}.scope-label{flex-shrink:0;font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:5px;color:var(--muted)}.group-head>a{flex-shrink:0;font-size:12px}.group-message{margin:16px 24px}
 .rules-table{min-width:850px}.records-table{min-width:1100px}th,td{padding:16px 20px;font-size:12px;vertical-align:top}.rules-table th:first-child{width:23%}.rules-table th:nth-child(2){width:34%}.records-table th:first-child{width:18%}.records-table th:nth-child(2){width:27%}.cell-stack{display:flex;flex-direction:column;align-items:flex-start;gap:6px;line-height:1.5}.cell-stack small{display:block;font-size:11px;overflow-wrap:anywhere;max-width:320px}.cell-stack strong{overflow-wrap:anywhere}.history-notice{padding:12px 16px;border:1px solid var(--border);border-radius:6px;margin-bottom:16px}.limit-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:16px}.limit-pagination small{font-size:12px}
 @media(max-width:700px){.limit-summary{gap:8px}.limit-summary .card{padding:16px 12px}.limit-summary strong{font-size:24px}.group-head{padding:18px 16px}.group-title{align-items:flex-start}.updated{margin-left:0;width:100%}.limit-search{max-width:none}.page-head>.actions{margin-top:8px}}
 @media(max-width:420px){.limit-summary{grid-template-columns:1fr}.limit-summary .card{display:grid;grid-template-columns:1fr auto;gap:6px 12px}.limit-summary strong{grid-column:2;grid-row:1 / 3}.group-head{align-items:flex-start;flex-direction:column}.limit-filter{width:100%}}
</style>
