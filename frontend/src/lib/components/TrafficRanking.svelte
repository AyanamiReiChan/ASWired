<script lang="ts">
 import Icon from './Icon.svelte';
 import CountryBadge from './CountryBadge.svelte';
 import Modal from './Modal.svelte';
 import {overviewBytes} from '../overview';
 import type {Row} from '../data';
 let {kind,rows,servers,period,pending=false,error='',incomplete=false}=$props<{
  kind:'servers'|'members';rows:Record<string,any>[];servers:Row[];period:string;pending?:boolean;error?:string;incomplete?:boolean;
 }>();
 let open=$state(false);
 const title=$derived(kind==='servers'?'节点视图':'用户视图');
 const description=$derived(kind==='servers'?'按接入服务器汇总 · 原始代理流量':'按用户汇总 · 加权代理流量');
 const totals=$derived(rows.reduce((sum:{up:number;down:number;bytes:number},row:Record<string,any>)=>({up:sum.up+row.up,down:sum.down+row.down,bytes:sum.bytes+row.bytes}),{up:0,down:0,bytes:0}));
 const emptyMessage=$derived(pending?'正在加载排行…':error?'排行暂时无法加载':'所选时间范围暂无流量记录');
 function destination(id:string){return kind==='servers'?`/servers?detail=${encodeURIComponent(id)}`:'/members';}
</script>

{#snippet identity(row:Record<string,any>)}
 {@const server=kind==='servers'?servers.find((server:Row)=>server.id===row.id):null}
 <span class="rank-identity">{#if server}<span class="rank-flag"><CountryBadge region={server.region} code={server.code} observedRegion={server.observation?.region}/></span>{/if}<span class="rank-name">{row.name}</span></span>
{/snippet}

<section class="card ranking-card">
 <header class="ranking-head"><div class="heading-copy"><span class="heading-icon"><Icon name={kind==='servers'?'server':'users'} size={19}/></span><div><h2>{title}</h2><p>{description}</p></div></div><button class="view-all" aria-label={`查看全部${title}`} aria-haspopup="dialog" onclick={()=>open=true}><span>查看全部</span><Icon name="external" size={15}/></button></header>
 <div class="rank-columns"><span>{period} · 按总流量排序</span><span>总流量</span><span>上传 / 下载</span></div>
 <div class="rank-list">
  {#each rows.slice(0,5) as row,index}
   <a class="rank-row" href={destination(row.id)}><span class="rank-position">{String(index+1).padStart(2,'0')}</span><div class="rank-label">{@render identity(row)}<div class="rank-track"><i style={`width:${rows[0]?.bytes?row.bytes/rows[0].bytes*100:0}%`}></i></div></div><strong class="rank-total">{overviewBytes(row.bytes)}</strong><div class="directions"><span><Icon name="up" size={11}/>{overviewBytes(row.up)}</span><span><Icon name="down" size={11}/>{overviewBytes(row.down)}</span></div></a>
  {:else}<div class="rank-empty" role="status">{emptyMessage}</div>{/each}
 </div>
 <footer class="rank-footer"><span>共 {rows.length} {kind==='servers'?'台服务器':'位用户'}{rows.length>5?' · 显示前 5 名':''}</span><span>{incomplete?'部分时段未上报':'按实际记录统计'}</span></footer>
</section>

<Modal bind:open wide title={`${title} · 全部排行`} description={`${period} · ${description}`}>
 <div class="modal-summary"><span>共 <strong>{rows.length}</strong> {kind==='servers'?'台服务器':'位用户'}</span><span>总流量 <strong>{overviewBytes(totals.bytes)}</strong></span></div>
 {#if error}<p class="modal-notice" role="status">{error}{rows.length?' · 显示上次记录':''}</p>{/if}
 <div class="full-rankings" aria-busy={pending}><table><thead><tr><th>排名</th><th>{kind==='servers'?'节点 / 服务器':'用户'}</th><th>上传</th><th>下载</th><th>总流量</th></tr></thead><tbody>
  {#each rows as row,index}<tr><td class="full-position">{String(index+1).padStart(2,'0')}</td><td><a class="full-name" href={destination(row.id)}>{@render identity(row)}</a></td><td class="full-up">{overviewBytes(row.up)}</td><td class="full-down">{overviewBytes(row.down)}</td><td><strong>{overviewBytes(row.bytes)}</strong></td></tr>
  {:else}<tr><td colspan="5"><div class="rank-empty" role="status">{emptyMessage}</div></td></tr>{/each}
 </tbody></table></div>
 <div class="modal-bottom"><span>{incomplete?'部分时段缺少上报，仅统计已接收流量。':'按实际记录统计，按总流量从高到低排序。'}</span><button class="button" onclick={()=>open=false}>关闭</button></div>
</Modal>

<style>
 .ranking-card{padding:1.2rem 1.3rem;display:flex;flex-direction:column;min-width:0}
 .ranking-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1.2rem}.heading-copy{display:flex;align-items:center;gap:.65rem;min-width:0}.heading-icon{height:2.1rem;width:2.1rem;display:grid;place-items:center;border-radius:.55rem;background:var(--nested);color:var(--primary);flex-shrink:0}.heading-copy h2{font-size:1.05rem;line-height:1.4}.heading-copy p{font-size:.65rem;color:var(--muted);margin:.2rem 0 0;line-height:1.5}.view-all{display:flex;align-items:center;justify-content:center;gap:.4rem;flex-shrink:0;min-height:2rem;padding:.3rem .55rem;border:1px solid var(--line);border-radius:.4rem;background:transparent;color:var(--muted);font-size:.68rem;cursor:pointer}.view-all:hover{color:var(--foreground);background:var(--nested);border-color:var(--border)}
 .rank-columns{display:grid;grid-template-columns:minmax(0,1fr) 6rem 6.5rem;gap:.8rem;padding:0 0 .65rem;border-bottom:1px solid var(--line);font-size:.62rem;color:var(--muted)}.rank-columns>span:not(:first-child){text-align:right}.rank-list{flex:1}.rank-row{display:grid;grid-template-columns:1.3rem minmax(0,1fr) 6rem 6.5rem;gap:.8rem;align-items:center;min-height:4.5rem;padding:1rem 0;border-bottom:1px solid var(--line)}.rank-row:last-child{border-bottom:0}.rank-position{font-size:.68rem;color:var(--primary);font-variant-numeric:tabular-nums}.rank-label{min-width:0}.rank-identity{display:flex;align-items:center;gap:.5rem;min-width:0}.rank-name{font-size:.77rem;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rank-flag{display:flex;align-items:center;flex-shrink:0}.rank-flag :global(.region-avatar){width:1.5rem;height:1.5rem;border-radius:.3rem}.rank-flag :global(img){width:1.15rem;height:.8rem;object-fit:cover}.rank-track{height:3px;border-radius:4px;background:var(--line);overflow:hidden;margin-top:.5rem}.rank-track i{display:block;height:100%;border-radius:inherit;background:var(--primary);opacity:.75}.rank-total{font-size:.76rem;font-weight:550;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.directions{display:flex;flex-direction:column;align-items:flex-end;gap:.4rem;font-size:.65rem;font-variant-numeric:tabular-nums}.directions span{display:flex;align-items:center;gap:.25rem;white-space:nowrap}.directions span:first-child,.full-up{color:var(--success)}.directions span:last-child,.full-down{color:var(--primary)}.rank-empty{display:flex;align-items:center;justify-content:center;min-height:6rem;color:var(--muted);font-size:.75rem}.rank-footer{display:flex;justify-content:space-between;gap:.6rem;padding-top:.8rem;margin-top:.2rem;border-top:1px solid var(--line);font-size:.62rem;color:var(--muted)}
 .modal-summary{display:flex;justify-content:space-between;gap:1rem;padding:.85rem 1rem;margin:.1rem 0 1rem;border:1px solid var(--line);border-radius:.5rem;color:var(--muted);font-size:.8rem;background:var(--nested)}.modal-summary strong{color:var(--foreground);font-weight:550;margin:0 .25rem}.full-rankings{max-height:55vh;overflow:auto;border:1px solid var(--line);border-radius:.5rem}.full-rankings table{min-width:550px;font-variant-numeric:tabular-nums}.full-rankings th{position:sticky;top:0;background:var(--card);z-index:1}.full-rankings td,.full-rankings th{padding:.8rem 1rem}.full-rankings td:nth-child(n+3),.full-rankings th:nth-child(n+3){text-align:right;white-space:nowrap}.full-rankings td strong{font-weight:550}.full-position{color:var(--primary);width:3.3rem}.full-name{display:block;min-width:10rem;max-width:25rem}.full-name .rank-name{white-space:normal;overflow-wrap:anywhere}.modal-bottom{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1.2rem}.modal-bottom>span,.modal-notice{color:var(--muted);font-size:.7rem;line-height:1.6}.modal-bottom .button{min-width:5rem}.modal-notice{margin-bottom:.8rem;color:var(--warning)}
 @media(max-width:1150px) and (min-width:901px){.ranking-head{gap:.5rem}.view-all span{display:none}.rank-columns{grid-template-columns:minmax(0,1fr) 4.8rem 5.5rem;gap:.5rem}.rank-row{grid-template-columns:1rem minmax(0,1fr) 4.8rem 5.5rem;gap:.5rem}.rank-total{font-size:.7rem}}
 @media(max-width:600px){.ranking-card{padding:1rem}.ranking-head{align-items:flex-start;gap:.5rem;margin-bottom:1rem}.heading-icon{width:1.8rem;height:1.8rem}.heading-copy{gap:.45rem}.heading-copy h2{font-size:1rem}.heading-copy p{font-size:.6rem;max-width:13rem}.view-all span{display:none}.view-all{min-width:2rem;padding:.35rem}.rank-columns{grid-template-columns:minmax(0,1fr) 5rem 5.2rem;gap:.4rem;font-size:.58rem}.rank-row{grid-template-columns:1rem minmax(0,1fr) 5rem 5.2rem;gap:.4rem}.rank-total{font-size:.68rem}.rank-name{font-size:.72rem}.rank-identity{gap:.3rem}.directions{font-size:.58rem}.rank-footer{font-size:.58rem}.modal-summary{flex-wrap:wrap}.modal-bottom{align-items:flex-end}.full-rankings{max-height:50vh}}
</style>
