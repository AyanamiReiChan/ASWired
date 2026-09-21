<script lang="ts">
 import Icon from '../components/Icon.svelte';
 import Badge from '../components/Badge.svelte';
 import CountryBadge from '../components/CountryBadge.svelte';
 import DailyTrafficChart from '../components/DailyTrafficChart.svelte';
 import TrafficRanking from '../components/TrafficRanking.svelte';
 import {api, APIError, demo, errorMessage} from '../store.svelte';
 import {quotaSummary, serverQuota, liveRates, trafficRanking, overviewBytes, nonnegative} from '../overview';
 import {monthlyTrafficReset} from '../server-display';
 import {formatNumber} from '../format';
 import type {Row} from '../data';
 let range = $state('30d');
 let result = $state<{servers:Row[];members:Row[];incomplete:boolean}|null>(null);
 let loading = $state(false), error = $state('');

 const periods = [{value:'24h',label:'近 24 小时'},{value:'7d',label:'近 7 天'},{value:'30d',label:'近 30 天'}];
 const rangeLabel = $derived(periods.find(period=>period.value===range)!.label);
 const servers = $derived(demo.data.servers);
 const quota = $derived(quotaSummary(servers));
 const rates = $derived(liveRates(servers));
 const source = $derived(range==='30d'?{servers:demo.data.trafficServers,members:demo.data.trafficMembers,incomplete:demo.trafficIncomplete}:result);
 const serverRanks = $derived(trafficRanking(source?.servers??[]));
 const memberRanks = $derived(trafficRanking(source?.members??[]));
 const pending = $derived(range==='30d'?!demo.trafficLoaded:loading);
 const loadError = $derived(range==='30d'?demo.trafficError:error);
 const userIdentity = $derived(demo.user?.id);
 const userRole = $derived(demo.user?.role);
 // Cancel stale period/identity requests and retain successful data during refresh.
 $effect(()=>{
  const period=range, identity=userIdentity, role=userRole;
  result=null; error=''; loading=false;
  if(period==='30d'||!identity||role!=='admin')return;
  const controller=new AbortController(); let busy=false;
  async function load(){
   if(busy||controller.signal.aborted)return;
   busy=true;loading=true;
   try{
    const data=await api(`/api/traffic?range=${period}${period==='24h'?'&interval=1m':''}`,{signal:controller.signal});
    if(controller.signal.aborted||demo.user?.id!==identity||demo.user?.role!=='admin')return;
    result={servers:data.servers??[],members:data.members??[],incomplete:data.incomplete===true};error='';
   }catch(cause){if(!controller.signal.aborted){if(cause instanceof APIError && [401,403].includes(cause.status))result=null;error=errorMessage(cause);}}
   finally{busy=false;if(!controller.signal.aborted)loading=false;}
  }
  void load();const timer=setInterval(()=>{if(!document.hidden)void load();},15000);
  return ()=>{controller.abort();clearInterval(timer);};
 });
</script>

<div class="overview">
 <div class="page-head"><div><div class="eyebrow">工作区 / 概览</div><h1>总览</h1><p class="muted">配额、用量与每一条连接的此刻。</p></div><div class="actions"><span class="online-pill"><i></i>{rates.online} / {servers.length} 台在线</span><a class="button" href="/servers"><Icon name="server"/>管理服务器</a></div></div>
 <div class="stat-grid overview-stats">
  <div class="stat-card"><div class="stat-label"><span>总流量配额</span><Icon name="database" size={20}/></div><div class="stat-number">{overviewBytes(quota.limit)}</div><div class="stat-foot"><span>{quota.finite} 台服务器的账期额度</span><span>{quota.unlimited?`${quota.unlimited} 台不限量`:quota.unconfigured?`${quota.unconfigured} 台未设额度`:'有限额度合计'}</span></div></div>
  <div class="stat-card"><div class="stat-label"><span>已用流量</span><Icon name="activity" size={20}/></div><div class="stat-number">{overviewBytes(quota.used)}</div><div class="stat-foot"><span>有限额度服务器 · 当前账期</span><span>{quota.unknown?`${quota.unknown} 台用量未知`:quota.incomplete?'含采集缺口':'含用量校准'}</span></div></div>
  <div class="stat-card"><div class="stat-label"><span>剩余流量</span><Icon name="layers" size={20}/></div><div class="stat-number">{overviewBytes(quota.remaining)}</div><div class="stat-foot"><span>各服务器可用余额合计</span><span>{quota.unknown?'仅汇总已知余额':'超额服务器按 0 计'}</span></div></div>
  <div class="stat-card"><div class="stat-label"><span>实时网速</span><Icon name="zap" size={20}/></div><div class="speed-values"><div><span><Icon name="up" size={13}/>上传</span><strong>{overviewBytes(rates.up,true)}</strong></div><div><span><Icon name="down" size={13}/>下载</span><strong>{overviewBytes(rates.down,true)}</strong></div></div><div class="stat-foot"><span>在线服务器网卡汇总</span><span>{rates.measured} / {rates.online} 台已上报</span></div></div>
 </div>
 <section class="card daily-card"><div class="section-head"><div><div class="section-kicker">TRAFFIC HISTORY</div><h2>每日流量消耗</h2><p class="muted small">最近 30 天的代理流量趋势</p></div><a class="traffic-link" href="/traffic" aria-label="流量分析" title="流量分析"><span>流量分析</span><Icon name="external" size={15}/></a></div><DailyTrafficChart/>
  {#if demo.trafficError}<p class="data-notice" role="status">{demo.trafficLoaded?'流量更新失败，显示上次记录。':demo.trafficError}</p>{:else if demo.trafficIncomplete && demo.data.traffic.length}<p class="data-notice">部分时段缺少上报，图表仅显示已接收的实际流量。</p>{/if}
 </section>
 <div class="ranking-toolbar"><div><h2>流量排行</h2><p class="muted small">找到用量最多的节点与用户</p></div><div class="segmented" aria-label="排行时间范围">{#each periods as period}<button class:active={range===period.value} aria-pressed={range===period.value} onclick={()=>range=period.value}>{period.label}</button>{/each}</div></div>
 {#if loadError}<p class="data-notice" role="status">{loadError}{source?' · 显示上次记录':''}</p>{/if}
 <div class="ranking-grid" aria-busy={pending}>
  <TrafficRanking kind="servers" rows={serverRanks} {servers} period={rangeLabel} {pending} error={loadError} incomplete={source?.incomplete??false}/>
  <TrafficRanking kind="members" rows={memberRanks} {servers} period={rangeLabel} {pending} error={loadError} incomplete={source?.incomplete??false}/>
 </div>
 <section class="card no-pad server-overview"><div class="section-head padded"><div><h2>服务器概览</h2><p class="muted small">网速实时更新，用量按各服务器账期统计</p></div><a href="/servers" class="quiet-link">查看全部<Icon name="arrow" size={15}/></a></div><div class="table-scroll"><table><thead><tr><th>服务器</th><th>实时网速</th><th>账期已用</th><th>总额度</th><th>剩余流量</th><th>使用率</th></tr></thead><tbody>
  {#each servers as server}{@const usage=serverQuota(server)}{@const online=server.probeOnline===true}
   <tr><td><a class="identity" href={`/servers?detail=${encodeURIComponent(server.id)}`}><CountryBadge region={server.region} code={server.code} observedRegion={server.observation?.region}/><div><strong>{server.name}</strong><small><Badge value={server.status}/></small></div></a></td><td><div class="table-rates"><span class="upload"><Icon name="up" size={12}/>{overviewBytes(online?nonnegative(server.upload):null,true)}</span><span class="download"><Icon name="down" size={12}/>{overviewBytes(online?nonnegative(server.download):null,true)}</span></div></td><td><strong>{overviewBytes(usage.used)}</strong><small class="quota-detail">{monthlyTrafficReset(server)??'尚未配置账期计量'}</small></td><td>{usage.unlimited?'不限量':overviewBytes(usage.limit)}</td><td>{usage.unlimited?'不限量':overviewBytes(usage.remaining)}</td><td><div class="usage-cell"><span class:over-limit={(usage.percent??0)>100}>{usage.percent===null?'—':`${formatNumber(usage.percent)}%`}</span><div class="usage-track"><i class:over-limit={(usage.percent??0)>100} style={`width:${Math.min(100,usage.percent??0)}%`}></i></div></div></td></tr>
  {:else}<tr><td colspan="6"><div class="empty">还没有服务器，接入 Agent 后即可查看用量与网速。</div></td></tr>{/each}
 </tbody></table></div><div class="table-note">额度与账期用量包含已保存的用量校准；每日趋势和排行使用代理流量台账。1 GB = 1,000,000,000 字节。</div></section>
</div>
<style>
 .traffic-link{display:flex;align-items:center;justify-content:center;gap:.4rem;flex-shrink:0;min-height:2rem;padding:.3rem .55rem;border:1px solid var(--line);border-radius:.4rem;background:transparent;color:var(--muted);font-size:.68rem;white-space:nowrap}.traffic-link:hover{color:var(--foreground);background:var(--nested);border-color:var(--border)}
 .overview{max-width:1560px;margin:0 auto}.online-pill{display:flex;align-items:center;gap:.45rem;color:var(--muted);font-size:.75rem;padding:.4rem .65rem}.online-pill i{width:6px;height:6px;border-radius:50%;background:var(--success)}.overview-stats .stat-card{padding:1.25rem;min-height:10rem;display:flex;flex-direction:column}.overview-stats .stat-label{font-weight:500;color:var(--foreground)}.overview-stats .stat-number{font-size:clamp(1.55rem,2.25vw,2.25rem);margin:.85rem 0 .6rem;font-variant-numeric:tabular-nums}.overview-stats .stat-foot{margin-top:auto;gap:.3rem;flex-direction:column;line-height:1.6}.speed-values{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin:1.1rem 0 1rem}.speed-values>div{display:flex;flex-direction:column;gap:.45rem}.speed-values span{display:flex;align-items:center;gap:.2rem;font-size:.68rem;color:var(--muted)}.speed-values strong{font-size:clamp(.9rem,1.25vw,1.25rem);white-space:nowrap;font-weight:550;letter-spacing:-.03em}.speed-values>div:first-child span,.upload{color:var(--success)}.speed-values>div:last-child span,.download{color:var(--primary)}.daily-card{padding:1.4rem 1.5rem;margin-bottom:1.7rem}.section-kicker{font-size:.57rem;letter-spacing:.16em;color:var(--primary);margin-bottom:.4rem}.daily-card .section-head{margin-bottom:0}.data-notice{font-size:.72rem;color:var(--warning);margin:.8rem 0 0;line-height:1.6}.ranking-toolbar{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:0 0 .9rem}.ranking-toolbar h2{font-size:1.2rem}.ranking-toolbar p{margin-top:.25rem}.ranking-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem}.server-overview .section-head{padding:1.25rem 1.4rem}.server-overview h2{font-size:1.2rem}.server-overview table{font-variant-numeric:tabular-nums}.server-overview td{white-space:nowrap}.server-overview td:first-child{min-width:13rem}.server-overview td strong{font-weight:500}.table-rates{display:flex;flex-direction:column;gap:.4rem;font-size:.72rem}.table-rates span{display:flex;align-items:center;gap:.3rem}.quota-detail{display:block;margin-top:.35rem;font-size:.6rem;color:var(--muted)}.usage-cell{min-width:5rem;font-size:.72rem}.usage-track{margin-top:.5rem;width:5rem;height:4px;border-radius:4px;background:var(--line);overflow:hidden}.usage-track i{display:block;height:100%;background:var(--primary)}.over-limit{color:var(--danger)}.usage-track i.over-limit{background:var(--danger)}.table-note{border-top:1px solid var(--line);padding:.9rem 1.4rem;color:var(--muted);font-size:.66rem;line-height:1.7}
 @media(min-width:901px) and (max-width:1200px){.overview-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:900px){.ranking-grid{grid-template-columns:1fr}.daily-card{padding:1.15rem}.overview-stats .stat-card{padding:1rem}.speed-values strong{font-size:1.1rem}}
 @media(max-width:600px){.ranking-toolbar{align-items:flex-start;flex-direction:column;gap:.8rem}.ranking-toolbar .segmented{width:100%}.ranking-toolbar .segmented button{flex:1}.overview-stats .stat-card{min-height:9.5rem;padding:.9rem}.overview-stats .stat-number{font-size:1.5rem}.speed-values{gap:.4rem;grid-template-columns:1fr;margin:.75rem 0}.speed-values>div{flex-direction:row;align-items:center;justify-content:space-between}.speed-values strong{font-size:.82rem}.speed-values span{font-size:.6rem}.overview-stats .stat-foot{font-size:.6rem}.daily-card .section-head{align-items:flex-start;gap:.5rem}.traffic-link{min-width:2rem;padding:.35rem}.traffic-link span{display:none}}
</style>
