<script lang="ts">
 import type {Snippet} from 'svelte';
 import type {Row} from '../data';
 import Icon from './Icon.svelte';
 import CountryBadge from './CountryBadge.svelte';
 import {hostTraffic,monthlyTrafficReset,trafficDirection} from '../server-display';
 import {formatNumber} from '../format';
 let {server,onview,actions}: {server:Row;onview?:()=>void;actions?:Snippet}=$props();
 const obs=$derived(server.observation??{});
 const online=$derived(server.probeOnline===true);
 const number=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
 const ratio=(used:unknown,total:unknown)=>number(used)!==null&&number(total)!==null&&Number(total)>0?Number(used)/Number(total)*100:null;
 const cpu=$derived(number(obs.cpu_percent??server.cpu));
 const memory=$derived(ratio(obs.memory_used,obs.memory_total)??number(server.memory));
 const disk=$derived(ratio(obs.disk_used,obs.disk_total));
 const traffic=$derived(hostTraffic(server));
 const reset=$derived(monthlyTrafficReset(server));
 const quota=$derived(Number(server.limit)>0?Number(server.limit):null);
 const trafficPercent=$derived(reset&&traffic&&quota?traffic.gb/quota*100:null);
 const pct=(v:number|null)=>v===null?'—':`${formatNumber(v)}%`;
 function bytes(v:unknown,decimal=false){const n=number(v);if(n===null)return '—';const base=decimal?1000:1024;const units=['B','KB','MB','GB','TB'];const i=n===0?0:Math.max(0,Math.min(4,Math.floor(Math.log(n)/Math.log(base))));return `${formatNumber(n/base**i)} ${units[i]}`;}
 const rate=(v:unknown)=>number(v)===null?'—':`${bytes(v)}/s`;
 const uptime=$derived(number(obs.uptime));
 const runtime=$derived(uptime===null?'运行时间未知':uptime>=86400?`运行 ${Math.floor(uptime/86400)} 天 ${Math.floor(uptime%86400/3600)} 时`:`运行 ${Math.floor(uptime/3600)} 时 ${Math.floor(uptime%3600/60)} 分`);
 const resources=$derived([
  {label:'CPU',icon:'cpu',value:cpu,color:'#9daeb8',detail:[obs.load1,obs.load5,obs.load15].map(v=>number(v)===null?'—':formatNumber(v)).join(' / ')},
  {label:'内存',icon:'memory',value:memory,color:'#8eaf9d',detail:`${bytes(obs.memory_used)} / ${bytes(obs.memory_total)}`},
  {label:'硬盘',icon:'database',value:disk,color:'#c1ac88',detail:`${bytes(obs.disk_used)} / ${bytes(obs.disk_total)}`},
  {label:reset?'本月流量':'累计流量',icon:'chart',value:trafficPercent,color:trafficPercent!==null&&trafficPercent>=90?'#d4ad73':'#ba9f92',detail:traffic?`${formatNumber(traffic.gb)}${reset&&quota?` / ${formatNumber(quota)}`:''} GB`:'—'}
 ]);
</script>

<article class="monitor-card" class:offline={!online} aria-label={`${server.name} 监控卡片`}>
 <header>
  <span class="status-dot" class:online title={online?'探针在线':'探针离线'}></span>
  <button class="server-name" onclick={onview} disabled={!onview} title={server.name}>{server.name}</button>
  <CountryBadge region={server.region} code={server.code} observedRegion={obs.region}/>
 </header>
 <div class="card-meta"><span class="runtime">{online?runtime:server.probeStatus??'Komari 离线'}</span><span class="source">Komari</span></div>
 <div class="resource-grid">
  {#each resources as resource}
   <div class="resource" style={`--metric-color:${resource.color}`} title={resource.label==='CPU'?'负载：1 / 5 / 15 分钟':resource.label==='本月流量'?reset??'':undefined}>
    <div class="resource-heading"><span><Icon name={resource.icon} size={13}/>{resource.label}</span><strong class:near-limit={resource.label==='本月流量'&&(resource.value??0)>=90}>{online?pct(resource.value):'—'}</strong></div>
    <div class="meter" role="meter" aria-label={resource.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={online&&resource.value!==null?Math.min(100,resource.value):undefined} aria-valuetext={online?pct(resource.value):'离线'}><i style={`width:${online&&resource.value!==null?Math.min(100,resource.value):0}%`}></i></div>
    <small>{resource.detail}</small>
   </div>
  {/each}
 </div>
 <div class="network-grid">
  <div class="network-box"><small>实时速率</small><span class="upload"><Icon name="up" size={12}/>{online?rate(obs.network_tx_per_second):'—'}</span><span class="download"><Icon name="down" size={12}/>{online?rate(obs.network_rx_per_second):'—'}</span></div>
  <div class="network-box" title="上传 / 下载采集值；校准差额仅计入总用量；十进制 GB"><small>{reset?'本账期采集':'累计传输'}</small><span><Icon name="up" size={12}/>{bytes(server.merchantTraffic?.uploadBytes??obs.network_tx_bytes,true)}</span><span><Icon name="down" size={12}/>{bytes(server.merchantTraffic?.downloadBytes??obs.network_rx_bytes,true)}</span></div>
  <div class="network-box"><small>{reset?'账期剩余':'月度额度'}</small><strong>{reset?(traffic&&quota?`${formatNumber(Math.max(0,quota-traffic.gb))} GB`:'—'):quota?`${formatNumber(quota)} GB`:'—'}</strong><span class="muted">{reset?trafficDirection(server):'未配置账期'}</span></div>
 </div>
 <div class="quality-grid">{#each ['延迟','丢包'] as label}<div class="quality-box"><div><span>{label}</span><span>—</span></div><div class="empty-history" title="尚无网络质量采样" aria-label={`${label}暂无数据`}></div></div>{/each}</div>
 <div class="reset-note" title={reset??'当前为探针累计用量'}><Icon name="clock" size={12}/>{reset??'累计用量 · 尚未配置月度重置'}</div>
 <footer><span class="provider">{server.provider||'未设置商家'}</span><span class="expiry" title="服务器到期日期">{server.expires?`${server.expires} 到期`:'未设置到期日'}</span>{#if actions}<div class="card-actions">{@render actions()}</div>{/if}</footer>
</article>

<style>
 .monitor-card{min-width:0;padding:16px;background:var(--card);border:1px solid var(--line);border-radius:14px;color:var(--foreground);box-shadow:0 4px 16px #0000000d;font-size:12px;font-variant-numeric:tabular-nums;transition:border-color .15s,transform .15s}
 .monitor-card:hover{border-color:var(--border);transform:translateY(-2px)}.offline{opacity:.65}
 header{display:flex;align-items:center;gap:8px}.status-dot{width:8px;height:8px;background:#77766f;border-radius:50%;flex-shrink:0}.status-dot.online{background:var(--success);box-shadow:0 0 0 4px color-mix(in srgb,var(--success) 10%,transparent)}
 .server-name{min-width:0;flex:1;background:none;border:0;padding:0;color:inherit;font-size:13px;font-weight:700;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.server-name:disabled{opacity:1;cursor:default}
 header :global(.region-avatar){width:25px;height:21px;background:transparent;border:0}header :global(.region-avatar img){width:23px;height:17px}
 .card-meta{display:flex;align-items:center;justify-content:space-between;margin:9px 0 17px;font-size:10px;color:var(--muted)}.runtime{padding:2px 7px;background:var(--nested);border-radius:20px}.source{color:var(--muted)}
 .resource-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 17px}.resource{min-width:0}.resource-heading{display:flex;justify-content:space-between;align-items:center;gap:4px}.resource-heading>span{display:flex;align-items:center;gap:5px}.resource-heading :global(svg){color:var(--metric-color)}.resource-heading strong{font-size:11px;font-weight:600}.near-limit{color:var(--warning)}
 .meter{height:4px;background:#3b3b36;border-radius:5px;margin:6px 0}.meter i{display:block;height:100%;background:var(--metric-color);border-radius:inherit}.resource small{display:block;font-size:10px;color:#c5c2b9;white-space:nowrap}
 .network-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:16px}.network-box{background:var(--nested);border-radius:9px;padding:9px 7px;display:flex;flex-direction:column;gap:5px;min-width:0;font-size:10px}.network-box small{font-size:9px;color:var(--muted);margin-bottom:1px}.network-box span{display:flex;align-items:center;gap:3px;white-space:nowrap}.network-box strong{font-size:11px;white-space:nowrap}.upload{color:#9cbaaa}.download{color:#b5b2a3}
 .quality-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.quality-box{border-radius:9px;background:var(--nested);padding:8px}.quality-box>div:first-child{display:flex;justify-content:space-between;font-size:10px;color:var(--muted)}.empty-history{height:10px;margin-top:6px;background:repeating-linear-gradient(90deg,#55554d 0 3px,transparent 3px 5px);opacity:.65}
 .reset-note{display:flex;align-items:center;gap:5px;font-size:9px;color:var(--muted);margin:12px 0;line-height:1.5}footer{border-top:1px solid var(--line);padding-top:10px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}.provider{border:1px solid var(--border);border-radius:20px;padding:2px 8px;font-size:10px}.expiry{font-size:9px;color:var(--muted)}.card-actions{margin-left:auto;display:flex;gap:1px}.card-actions :global(.icon-button){width:24px;height:24px;color:var(--muted)}.card-actions :global(.icon-button:hover){background:var(--nested);color:var(--foreground)}
 @media(prefers-reduced-motion:reduce){.monitor-card{transition:none}.monitor-card:hover{transform:none}}
</style>
