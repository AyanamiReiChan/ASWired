<script lang="ts">
 import Icon from './Icon.svelte';
 import CountryBadge from './CountryBadge.svelte';
 import Modal from './Modal.svelte';
 import {overviewBytes} from '../overview';
 import type {Row} from '../data';
 let {kind,rows,servers,period,pending=false,error='',incomplete=false,mode=$bindable('proxy')}=$props<{
  kind:'servers'|'members';rows:Record<string,any>[];servers:Row[];period:string;pending?:boolean;error?:string;incomplete?:boolean;mode?:'proxy'|'billing';
 }>();
 let open=$state(false);
 const billing=$derived(kind==='servers'&&mode==='billing');
 const title=$derived(billing?'整机本期用量':kind==='servers'?'代理业务流量':'用户视图');
 const description=$derived(billing?'按各服务器独立账期 · 含用量校准':kind==='servers'?'按接入服务器汇总 · 原始代理流量':'按用户汇总 · 加权代理流量');
 const knownRows=$derived(rows.filter((row:Record<string,any>)=>known(row.bytes)));
 const unknownCount=$derived(rows.length-knownRows.length);
 const totalBytes=$derived(knownRows.length?knownRows.reduce((sum:number,row:Record<string,any>)=>sum+row.bytes,0):null);
 const highestBytes=$derived(knownRows[0]?.bytes??0);
 const emptyMessage=$derived(error?'排行暂时无法加载':pending?'正在加载排行…':billing?'暂无服务器账期用量':'所选时间范围暂无流量记录');
 function destination(id:string){return kind==='servers'?`/servers?detail=${encodeURIComponent(id)}`:'/members';}
 function known(value:unknown):value is number{return typeof value==='number'&&Number.isFinite(value)&&value>=0;}
 function dateLabel(value:unknown,full=false){
  if(typeof value!=='string'||!value)return '未知';
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return '未知';
  return date.toLocaleString('zh-CN',full?{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}:{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
 }
 function periodLabel(row:Record<string,any>){return row.periodStart&&row.periodEnd?`${dateLabel(row.periodStart)} → ${dateLabel(row.periodEnd)}`:'账期待建立';}
 function measurementLabel(row:Record<string,any>){return ({sum:'双向合计',upload:'仅出站',download:'仅入站',max:'出入站较大值'} as Record<string,string>)[row.direction]??'计量方向未知';}
 function adjustmentLabel(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value!==0?`${value>0?'+':'−'}${overviewBytes(Math.abs(value))}`:'无';}
 function sampleStatus(row:Record<string,any>){
  if(row.probeOnline===false)return '探针离线';
  const sample=typeof row.sampleAt==='string'?new Date(row.sampleAt).getTime():NaN;
  return !Number.isFinite(sample)?'上报时间未知':Date.now()-sample>10*60*1000?'上报已延迟':'';
 }
</script>

{#snippet identity(row:Record<string,any>)}
 {@const server=kind==='servers'?servers.find((server:Row)=>server.id===row.id):null}
 <span class="rank-identity">{#if server}<span class="rank-flag"><CountryBadge region={server.region} code={server.code} observedRegion={server.observation?.region}/></span>{/if}<span class="rank-name">{row.name}</span></span>
{/snippet}

<section class="card ranking-card">
 {#if kind==='servers'}<div class="metric-switch" aria-label="服务器排行统计口径"><button class:active={mode==='billing'} aria-pressed={mode==='billing'} onclick={()=>mode='billing'}>整机本期用量</button><button class:active={mode==='proxy'} aria-pressed={mode==='proxy'} onclick={()=>mode='proxy'}>代理业务流量</button></div>{/if}
 <header class="ranking-head"><div class="heading-copy"><span class="heading-icon"><Icon name={kind==='servers'?'server':'users'} size={19}/></span><div><h2>{title}</h2><p>{description}</p></div></div><button class="view-all" aria-label={`查看全部${title}`} aria-haspopup="dialog" onclick={()=>open=true}><span>查看全部</span><Icon name="external" size={15}/></button></header>
 <div class="rank-columns"><span>{billing?'各机本期':period} · 按用量排序</span><span>{billing?'本期用量':'总流量'}</span><span>{billing?'原始出站 / 入站':'上传 / 下载'}</span></div>
 <div class="rank-list">
  {#each rows.slice(0,5) as row,index}
   <a class="rank-row" href={destination(row.id)}><span class="rank-position">{known(row.bytes)?String(index+1).padStart(2,'0'):'—'}</span><div class="rank-label">{@render identity(row)}
    {#if billing}<span class="rank-period" title={row.periodStart&&row.periodEnd?`${dateLabel(row.periodStart,true)} → ${dateLabel(row.periodEnd,true)}`:undefined}>{periodLabel(row)}</span>{/if}
    {#if known(row.bytes)}<div class="rank-track"><i style={`width:${highestBytes?Math.min(100,Math.max(0,row.bytes/highestBytes*100)):0}%`}></i></div>{:else if billing}<span class="rank-warning">{row.unknownReason||'本期用量未知'}</span>{/if}
    {#if billing&&(row.gap||sampleStatus(row))}<span class="rank-warning">{[row.gap?'账期有采样缺口':'',sampleStatus(row)].filter(Boolean).join(' · ')}</span>{/if}
   </div><strong class="rank-total">{known(row.bytes)?overviewBytes(row.bytes):'未知'}</strong><div class="directions"><span><Icon name="up" size={11}/>{overviewBytes(row.up)}</span><span><Icon name="down" size={11}/>{overviewBytes(row.down)}</span></div></a>
  {:else}<div class="rank-empty" role="status">{emptyMessage}</div>{/each}
 </div>
 <footer class="rank-footer"><span>共 {rows.length} {kind==='servers'?'台服务器':'位用户'}{rows.length>5?' · 显示前 5 项':''}{billing&&unknownCount?` · ${unknownCount} 台用量未知`:''}</span><span>{billing?'各机独立账期':incomplete?'部分时段未上报':'按实际记录统计'}</span></footer>
</section>

<Modal bind:open wide title={`${title} · 全部排行`} description={`${billing?'各机本期':period} · ${description}`}>
 <div class="modal-summary"><span>共 <strong>{rows.length}</strong> {kind==='servers'?'台服务器':'位用户'}{#if billing} · 已知 <strong>{knownRows.length}</strong> 台{#if unknownCount} · 未知 <strong>{unknownCount}</strong> 台{/if}{/if}</span><span>{billing?'已知本期用量合计':'总流量'} <strong>{overviewBytes(totalBytes)}</strong></span></div>
 {#if billing}<p class="billing-explanation">按各服务器自己的账期排序，账期起止可能不同。本期用量按计量方向计算并包含校准值，可能不等于原始出站与入站之和。缺少有效账期数据的机器标为未知，不参与排名。时间按浏览器所在时区显示。</p>{/if}
 {#if error}<p class="modal-notice" role="status">{error}{rows.length?' · 显示上次记录':''}</p>{/if}
 <div class="full-rankings" aria-busy={pending}><table><thead><tr><th>排名</th><th>{kind==='servers'?'节点 / 服务器':'用户'}</th><th>{billing?'原始出站':'上传'}</th><th>{billing?'原始入站':'下载'}</th><th>{billing?'本期用量':'总流量'}</th></tr></thead><tbody>
  {#each rows as row,index}<tr><td class="full-position">{known(row.bytes)?String(index+1).padStart(2,'0'):'—'}</td><td><a class="full-name" href={destination(row.id)}>{@render identity(row)}</a>
   {#if billing}<div class="billing-details"><span>账期：{periodLabel(row)}</span><span>最近上报：{dateLabel(row.sampleAt,true)}{sampleStatus(row)?` · ${sampleStatus(row)}`:''}</span>{#if known(row.bytes)}<span>计量：{measurementLabel(row)} · 校准：{adjustmentLabel(row.adjustmentBytes)}</span>{:else}<span class="rank-warning">{row.unknownReason||'本期用量未知'}</span>{/if}{#if row.gap}<span class="rank-warning">账期有采样缺口{row.coverageStart?` · 记录起于 ${dateLabel(row.coverageStart)}`:''}</span>{/if}</div>{/if}
  </td><td class="full-up">{overviewBytes(row.up)}</td><td class="full-down">{overviewBytes(row.down)}</td><td><strong>{known(row.bytes)?overviewBytes(row.bytes):'未知'}</strong></td></tr>
  {:else}<tr><td colspan="5"><div class="rank-empty" role="status">{emptyMessage}</div></td></tr>{/each}
 </tbody></table></div>
 <div class="modal-bottom"><span>{billing?'按整机账期账本统计，计量方向与校准以各机设置为准；有采样缺口时需结合账期覆盖情况核对。':incomplete?'部分时段缺少上报，仅统计已接收流量。':'按实际记录统计，按总流量从高到低排序。'}</span><button class="button" onclick={()=>open=false}>关闭</button></div>
</Modal>

<style>
 .ranking-card{padding:1.2rem 1.3rem;display:flex;flex-direction:column;min-width:0}
 .metric-switch{display:flex;align-self:flex-start;gap:.2rem;padding:.2rem;margin-bottom:1rem;background:var(--nested);border:1px solid var(--line);border-radius:.45rem}.metric-switch button{padding:.4rem .65rem;border:0;border-radius:.3rem;background:transparent;color:var(--muted);font-size:.67rem;cursor:pointer}.metric-switch button.active{background:var(--card);color:var(--foreground);box-shadow:0 0 0 1px var(--line)}.metric-switch button:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
 .rank-period{display:block;margin-top:.25rem;color:var(--muted);font-size:.58rem;line-height:1.5}.rank-warning{display:block;margin-top:.25rem;color:var(--warning);font-size:.6rem;line-height:1.5}.billing-details{display:flex;flex-direction:column;gap:.25rem;margin-top:.4rem;color:var(--muted);font-size:.65rem;line-height:1.5}.billing-details .rank-warning{margin:0;font-size:inherit}.billing-explanation{margin:0 0 1rem;color:var(--muted);font-size:.7rem;line-height:1.7}
 .ranking-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1.2rem}.heading-copy{display:flex;align-items:center;gap:.65rem;min-width:0}.heading-icon{height:2.1rem;width:2.1rem;display:grid;place-items:center;border-radius:.55rem;background:var(--nested);color:var(--primary);flex-shrink:0}.heading-copy h2{font-size:1.05rem;line-height:1.4}.heading-copy p{font-size:.65rem;color:var(--muted);margin:.2rem 0 0;line-height:1.5}.view-all{display:flex;align-items:center;justify-content:center;gap:.4rem;flex-shrink:0;min-height:2rem;padding:.3rem .55rem;border:1px solid var(--line);border-radius:.4rem;background:transparent;color:var(--muted);font-size:.68rem;cursor:pointer}.view-all:hover{color:var(--foreground);background:var(--nested);border-color:var(--border)}
 .rank-columns{display:grid;grid-template-columns:minmax(0,1fr) 6rem 6.5rem;gap:.8rem;padding:0 0 .65rem;border-bottom:1px solid var(--line);font-size:.62rem;color:var(--muted)}.rank-columns>span:not(:first-child){text-align:right}.rank-list{flex:1}.rank-row{display:grid;grid-template-columns:1.3rem minmax(0,1fr) 6rem 6.5rem;gap:.8rem;align-items:center;min-height:4.5rem;padding:1rem 0;border-bottom:1px solid var(--line)}.rank-row:last-child{border-bottom:0}.rank-position{font-size:.68rem;color:var(--primary);font-variant-numeric:tabular-nums}.rank-label{min-width:0}.rank-identity{display:flex;align-items:center;gap:.5rem;min-width:0}.rank-name{font-size:.77rem;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rank-flag{display:flex;align-items:center;flex-shrink:0}.rank-flag :global(.region-avatar){width:1.5rem;height:1.5rem;border-radius:.3rem}.rank-flag :global(img){width:1.15rem;height:.8rem;object-fit:cover}.rank-track{height:3px;border-radius:4px;background:var(--line);overflow:hidden;margin-top:.5rem}.rank-track i{display:block;height:100%;border-radius:inherit;background:var(--primary);opacity:.75}.rank-total{font-size:.76rem;font-weight:550;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.directions{display:flex;flex-direction:column;align-items:flex-end;gap:.4rem;font-size:.65rem;font-variant-numeric:tabular-nums}.directions span{display:flex;align-items:center;gap:.25rem;white-space:nowrap}.directions span:first-child,.full-up{color:var(--success)}.directions span:last-child,.full-down{color:var(--primary)}.rank-empty{display:flex;align-items:center;justify-content:center;min-height:6rem;color:var(--muted);font-size:.75rem}.rank-footer{display:flex;justify-content:space-between;gap:.6rem;padding-top:.8rem;margin-top:.2rem;border-top:1px solid var(--line);font-size:.62rem;color:var(--muted)}
 .modal-summary{display:flex;justify-content:space-between;gap:1rem;padding:.85rem 1rem;margin:.1rem 0 1rem;border:1px solid var(--line);border-radius:.5rem;color:var(--muted);font-size:.8rem;background:var(--nested)}.modal-summary strong{color:var(--foreground);font-weight:550;margin:0 .25rem}.full-rankings{max-height:55vh;overflow:auto;border:1px solid var(--line);border-radius:.5rem}.full-rankings table{min-width:550px;font-variant-numeric:tabular-nums}.full-rankings th{position:sticky;top:0;background:var(--card);z-index:1}.full-rankings td,.full-rankings th{padding:.8rem 1rem}.full-rankings td:nth-child(n+3),.full-rankings th:nth-child(n+3){text-align:right;white-space:nowrap}.full-rankings td strong{font-weight:550}.full-position{color:var(--primary);width:3.3rem}.full-name{display:block;min-width:10rem;max-width:25rem}.full-name .rank-name{white-space:normal;overflow-wrap:anywhere}.modal-bottom{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1.2rem}.modal-bottom>span,.modal-notice{color:var(--muted);font-size:.7rem;line-height:1.6}.modal-bottom .button{min-width:5rem}.modal-notice{margin-bottom:.8rem;color:var(--warning)}
 @media(max-width:1150px) and (min-width:901px){.ranking-head{gap:.5rem}.view-all span{display:none}.rank-columns{grid-template-columns:minmax(0,1fr) 4.8rem 5.5rem;gap:.5rem}.rank-row{grid-template-columns:1rem minmax(0,1fr) 4.8rem 5.5rem;gap:.5rem}.rank-total{font-size:.7rem}}
 @media(max-width:600px){.ranking-card{padding:1rem}.ranking-head{align-items:flex-start;gap:.5rem;margin-bottom:1rem}.heading-icon{width:1.8rem;height:1.8rem}.heading-copy{gap:.45rem}.heading-copy h2{font-size:1rem}.heading-copy p{font-size:.6rem;max-width:13rem}.view-all span{display:none}.view-all{min-width:2rem;padding:.35rem}.rank-columns{grid-template-columns:minmax(0,1fr) 5rem 5.2rem;gap:.4rem;font-size:.58rem}.rank-row{grid-template-columns:1rem minmax(0,1fr) 5rem 5.2rem;gap:.4rem}.rank-total{font-size:.68rem}.rank-name{font-size:.72rem}.rank-identity{gap:.3rem}.directions{font-size:.58rem}.rank-footer{font-size:.58rem}.modal-summary{flex-wrap:wrap}.modal-bottom{align-items:flex-end}.full-rankings{max-height:50vh}}
</style>
