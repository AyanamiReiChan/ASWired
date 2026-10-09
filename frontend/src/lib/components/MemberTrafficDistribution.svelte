<script lang="ts">
 import {onDestroy} from 'svelte';
 import type {Row} from '../data';
 import {api} from '../store.svelte';
 import {formatNumber} from '../format';
 import {formatTrafficBytes} from '../traffic-chart';
 import {createMemberTrafficLoader,memberTrafficRanges,type MemberTrafficRange,type MemberTrafficState} from '../member-traffic';
 import Modal from './Modal.svelte';
 import Icon from './Icon.svelte';

 let {open=$bindable(false),member}=$props<{open?:boolean;member:Pick<Row,'id'> & {username?:string;name?:string}}>();
 let range=$state<MemberTrafficRange>('cycle'),revision=$state(0);
 let requestState=$state<MemberTrafficState>({loading:false,data:null,error:''});
 const loader=createMemberTrafficLoader(api,next=>requestState=next);
 const data=$derived(requestState.data);
 const nodeCount=$derived(data?.rows.filter(row=>row.kind==='inbound').length??0);
 $effect(()=>{
  revision;
  if(open&&member.id)void loader.load(member.id,range);
  return loader.cancel;
 });
 onDestroy(loader.cancel);
 function timestamp(value:string|null){return value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'—';}
</script>

<Modal bind:open title="用户流量分布" description={member.username||member.name||'用户流量'} wide>
 <div class="distribution-toolbar">
  <div class="range-switch" role="group" aria-label="流量统计范围">
   {#each memberTrafficRanges as item}<button type="button" class:active={range===item.value} aria-pressed={range===item.value} onclick={()=>range=item.value}>{item.label}</button>{/each}
  </div>
  <button type="button" class="button small" disabled={requestState.loading} onclick={()=>revision++}><Icon name="refresh"/>刷新</button>
 </div>
 <p class="distribution-note">仅统计此用户的流量，共享套餐不会合并其他成员的用量。计费用量已包含当时的倍率，节点占比按计费用量计算；原始流量为节点上报值。</p>
 <div aria-busy={requestState.loading}>
  {#if requestState.loading}<div class="distribution-empty" role="status">正在读取此用户的节点流量…</div>
  {:else if requestState.error}<div class="distribution-error" role="alert"><p>{requestState.error}</p><button type="button" class="button" onclick={()=>revision++}>重新加载</button></div>
  {:else if data}
   <div class="distribution-summary">
    <div><span>本人计费用量</span><strong>{formatTrafficBytes(data.totals.totalBytes)}</strong><small>上传 {formatTrafficBytes(data.totals.uploadBytes)} · 下载 {formatTrafficBytes(data.totals.downloadBytes)}</small></div>
    <div><span>本人原始流量</span><strong>{formatTrafficBytes(data.totals.rawTotalBytes)}</strong><small>上传 {formatTrafficBytes(data.totals.rawUploadBytes)} · 下载 {formatTrafficBytes(data.totals.rawDownloadBytes)}</small></div>
    <div><span>可识别节点</span><strong>{nodeCount}<em> 个</em></strong><small>{data.hasUnmappedTraffic?'另有历史或无法细分的流量':'按采集入站区分节点'}</small></div>
   </div>
   {#if data.totals.gap}<p class="distribution-warning" role="status">部分采样存在缺口，以下展示已接收的流量，不能视为完整用量。</p>{/if}
   {#if data.hasUnmappedTraffic}<p class="distribution-note">历史或无法细分的流量单独保留；未能确认的节点不会强行归入当前节点。</p>{/if}
   <div class="distribution-period"><span>{range==='cycle'?'本期按当前每个套餐实例的个人账期统计。':'按所选时间统计，包含已删除套餐实例在此期间的流量。'}</span><small>截至 {timestamp(data.to)}</small></div>
   {#if range==='cycle'&&data.windows.length}<details class="distribution-windows"><summary>查看 {data.windows.length} 个套餐实例的统计区间</summary><ul>{#each data.windows as window}<li><strong>{window.subscriptionName||'套餐实例'}</strong><span>{timestamp(window.from)} — {timestamp(window.to)}</span></li>{/each}</ul><p>区间包含起点，不包含终点；未完成的账期统计至本次查询时间。</p></details>{:else if data.from}<p class="distribution-note">{timestamp(data.from)} — {timestamp(data.to)}（不含终点）</p>{/if}
   {#if data.rows.length}
    <div class="distribution-table-wrap"><table class="distribution-table"><thead><tr><th>节点 / 服务器</th><th>计费用量</th><th>原始流量</th><th>计费占比</th></tr></thead><tbody>
     {#each data.rows as row (row.id)}<tr>
      <td class="distribution-node"><strong>{row.nodeName}</strong><small>{row.serverName||'服务器信息不可用'}</small>{#if row.kind==='historical'}<span class="distribution-tag">历史 / 未细分</span>{/if}{#if row.gap}<span class="distribution-tag">采样有缺口</span>{/if}</td>
      <td class="distribution-bytes"><strong>{formatTrafficBytes(row.totalBytes)}</strong><small>上传 {formatTrafficBytes(row.uploadBytes)}</small><small>下载 {formatTrafficBytes(row.downloadBytes)}</small></td>
      <td class="distribution-bytes"><strong>{formatTrafficBytes(row.rawTotalBytes)}</strong><small>上传 {formatTrafficBytes(row.rawUploadBytes)}</small><small>下载 {formatTrafficBytes(row.rawDownloadBytes)}</small></td>
      <td class="distribution-share"><span>{formatNumber(row.share)}%</span><div class="distribution-meter" role="meter" aria-label={`${row.nodeName} 的计费流量占比`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.share}><span style={`width:${row.share}%`}></span></div></td>
     </tr>{/each}
    </tbody></table></div>
   {:else}<div class="distribution-empty">{range==='cycle'&&!data.windows.length?'此用户尚无当前套餐实例，可切换时间范围查看历史用量。':'此范围内暂无已记录的用户流量。'}</div>{/if}
   <p class="distribution-note distribution-updated">统计生成于 {timestamp(data.generatedAt)}</p>
  {/if}
 </div>
 <div class="modal-actions"><button type="button" class="button" onclick={()=>open=false}>关闭</button></div>
</Modal>

<style>
 .distribution-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:18px 0 12px}.range-switch{display:flex;gap:4px;flex-wrap:wrap;padding:4px;border-radius:7px;background:var(--nested)}.range-switch button{border:0;border-radius:4px;background:transparent;color:var(--muted);padding:7px 10px;font-size:12px}.range-switch button.active{background:color-mix(in srgb,var(--primary) 15%,transparent);color:var(--primary)}.distribution-note{font-size:12px;line-height:1.7;color:var(--muted);margin:10px 0;overflow-wrap:anywhere}.distribution-summary{display:grid;grid-template-columns:1fr 1fr .8fr;gap:10px;margin:18px 0}.distribution-summary>div{display:flex;flex-direction:column;gap:8px;padding:15px;border:1px solid var(--border);border-radius:8px;min-width:0;background:var(--nested)}.distribution-summary span{font-size:12px;color:var(--muted)}.distribution-summary strong{font-size:23px;font-weight:600;letter-spacing:-.03em;overflow-wrap:anywhere}.distribution-summary em{font-size:12px;font-style:normal;font-weight:400;color:var(--muted)}.distribution-summary small{font-size:11px;line-height:1.6;color:var(--muted)}.distribution-period{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;color:var(--muted);font-size:12px;line-height:1.6;margin:12px 0}.distribution-period small{font-size:11px}.distribution-windows{font-size:12px;margin:12px 0;color:var(--muted)}.distribution-windows summary{cursor:pointer}.distribution-windows ul{padding-left:20px}.distribution-windows li{margin:10px 0}.distribution-windows li span{display:block;font-size:11px;margin-top:3px}.distribution-windows p{font-size:11px;line-height:1.6}.distribution-table-wrap{overflow:auto;border:1px solid var(--border);border-radius:8px;margin-top:14px}.distribution-table{min-width:650px;table-layout:fixed}.distribution-table th,.distribution-table td{padding:12px;vertical-align:middle}.distribution-table th:first-child{width:32%}.distribution-table th:last-child{width:20%}.distribution-table strong{font-size:12px;font-weight:550}.distribution-table small{display:block;font-size:11px;color:var(--muted);margin-top:5px;line-height:1.5}.distribution-node{overflow-wrap:anywhere}.distribution-bytes{white-space:nowrap}.distribution-share>span{font-size:12px;font-variant-numeric:tabular-nums}.distribution-meter{position:static;height:5px;border-radius:5px;overflow:hidden;background:var(--nested);margin-top:8px;width:100%}.distribution-meter>span{display:block;height:100%;background:var(--primary);border-radius:inherit}.distribution-tag{display:inline-block;font-size:10px;color:var(--muted);background:var(--nested);padding:3px 5px;margin:6px 4px 0 0;border-radius:3px}.distribution-warning{font-size:12px;line-height:1.6;color:var(--warning);border:1px solid color-mix(in srgb,var(--warning) 35%,transparent);border-radius:6px;padding:10px 12px}.distribution-empty{padding:42px 16px;text-align:center;font-size:13px;line-height:1.7;color:var(--muted)}.distribution-error{padding:24px 12px;text-align:center;color:var(--danger);font-size:13px}.distribution-error .button{margin-top:14px}.distribution-updated{text-align:right;font-size:11px}@media(max-width:680px){.distribution-summary{grid-template-columns:1fr}.distribution-summary>div{padding:12px}.distribution-summary strong{font-size:21px}.distribution-toolbar{align-items:flex-start}.range-switch button{padding:7px}.distribution-period{flex-direction:column}}
</style>
