<script lang="ts">
 import type {Snippet} from 'svelte';
 import type {Row} from '../data';
 import Icon from './Icon.svelte';
 import AppSelect from './Select.svelte';
 import CountryBadge from './CountryBadge.svelte';
 import {nonnegative,overviewBytes,serverQuota} from '../overview';
 import {monthlyTrafficReset,trafficDirection} from '../server-display';
 let {server,hideIP=false,onview,onconfig,onagent,onconnection,actions}: {server:Row;hideIP?:boolean;onview?:()=>void;onconfig?:()=>void;onagent?:()=>void;onconnection?:(mode:string)=>Promise<void>;actions?:Snippet}=$props();
 let changing=$state(false);
 const configured=$derived(({auto:'自动',pull:'轮询',http:'HTTP',websocket:'WebSocket'} as Record<string,string>)[String(server.connection)]??server.connection??'WebSocket');
 const desired=$derived(({自动:'auto',轮询:'pull',HTTP:'http',WebSocket:'websocket'} as Record<string,string>)[configured]);
 const pending=$derived(server.connectionSwitchSupported&&server.appliedConnection&&server.appliedConnection!==desired);
 async function changeConnection(mode:string){if(!onconnection||changing||mode===configured)return;changing=true;try{await onconnection(mode);}finally{changing=false;}}
 const online=$derived(['在线','告警'].includes(server.status));
 const live=$derived(server.probeOnline===true);
 const quota=$derived(serverQuota(server));
 const reset=$derived(monthlyTrafficReset(server));
 function heartbeat(value:unknown){
  if(!value)return '尚未收到心跳';
  const date=new Date(typeof value==='number'?(value<1e12?value*1000:value):String(value));
  return Number.isNaN(date.getTime())?'尚未收到心跳':date.toLocaleString('zh-CN',{hour12:false});
 }
</script>

<article class="management-card" aria-label={`${server.name} 管理卡片`}>
 <header><span class="status-dot" class:online></span><button class="server-name" onclick={onview} disabled={!onview} title={server.name}>{server.name}</button><CountryBadge region={server.region} code={server.code} observedRegion={server.observation?.region}/></header>
 <div class="identity-row"><div class="badges"><span class="status" class:online>{server.status??'待接入'}</span><span class="chip">内嵌 Xray</span>{#if server.provider}<span class="provider" title={server.provider}>{server.provider}</span>{/if}</div>{#if actions}<div class="card-actions">{@render actions()}</div>{/if}</div>
 <div class="connection"><span class="address">{hideIP?'•••.•••.•••.•••':server.address||'未设置地址'}</span><div class="connection-controls">{#if onconnection}{#key `${server.id}:${configured}:${changing}`}<AppSelect aria-label={`${server.name} 连接模式`} value={configured} options={['自动','WebSocket','HTTP','轮询']} disabled={changing} onchange={changeConnection}/>{/key}{:else}<span class="protocol">{configured}</span>{/if}<span class="protocol" title="当前实际通信通道"><Icon name="network" size={12}/>{online?server.activeConnection??'等待上报':'未连接'}</span></div></div>
 {#if pending}<p class="connection-hint">等待 Agent 应用连接模式</p>{:else if server.connectionSwitchSupported===false&&configured!=='WebSocket'}<p class="connection-hint">请升级 Agent 以应用此连接模式</p>{/if}
 <div class="versions"><span title={server.core??'尚未上报'}>Xray <strong>{server.core??'尚未上报'}</strong></span><span title={server.agentVersion??'尚未上报'}>Agent <strong>{server.agentVersion??'尚未上报'}</strong></span></div>
 <div class="traffic-panel">
  <div class="speed-row"><span class="metric-label"><Icon name="activity" size={14}/>实时网速</span><div class="rates"><span class="upload"><Icon name="up" size={13}/>{overviewBytes(live?nonnegative(server.upload??server.observation?.network_tx_per_second):null,true)}</span><span class="download"><Icon name="down" size={13}/>{overviewBytes(live?nonnegative(server.download??server.observation?.network_rx_per_second):null,true)}</span></div></div>
  <div class="usage-row"><span class="metric-label"><Icon name="chart" size={14}/>账期流量</span><strong>{overviewBytes(quota.used)} <small>/ {quota.unlimited?'不限流量':overviewBytes(quota.limit)}</small></strong></div>
  <div class="meter" class:warning={(quota.percent??0)>=90} role="meter" aria-label="账期流量使用率" aria-valuemin={0} aria-valuemax={100} aria-valuenow={quota.percent===null?undefined:Math.min(100,quota.percent)} aria-valuetext={quota.percent===null?(quota.unlimited?'不限流量':'未配置账期或等待采样'):`${quota.percent.toFixed(1)}%`}><i style={`width:${Math.min(100,quota.percent??0)}%`}></i></div>
  <div class="billing-meta"><span>{server.merchantTraffic?.configured?trafficDirection(server):'未配置账期'}</span><span>{quota.unlimited?'不限额度':`剩余 ${overviewBytes(quota.remaining)}`}</span></div>
  <div class="reset-row"><span>重置</span><span title={reset??undefined}>{server.merchantTraffic?.configured?`每月 ${server.merchantTraffic.resetDay} 日`:reset??'尚未配置'}</span></div>
  {#if quota.gap}<p class="gap" title={server.merchantTraffic?.gapReason}><Icon name="warning" size={12}/>统计不完整，可按商家用量校准</p>{/if}
  <div class="heartbeat"><Icon name="clock" size={12}/><span>最后心跳</span><time>{heartbeat(server.lastSeen)}</time></div>
 </div>
 {#if onconfig||onagent}<footer>{#if onconfig}<button class="button" onclick={onconfig}><Icon name="code" size={15}/>Xray 配置</button>{/if}{#if onagent}<button class="button" onclick={onagent}><Icon name="settings" size={15}/>Agent</button>{/if}</footer>{/if}
</article>

<style>
 .connection-controls{display:flex;align-items:center;gap:6px;flex-shrink:0}.connection-controls :global(.app-select-trigger){min-height:28px;height:28px;padding:3px 7px;font-size:11px;min-width:90px}.connection-hint{margin:-8px 0 0;color:var(--muted);font-size:11px}
 .management-card{min-width:0;display:flex;flex-direction:column;gap:15px;padding:20px;background:var(--card);border:1px solid var(--line);border-radius:16px;color:var(--foreground);box-shadow:0 4px 20px #00000008;font-size:12px;font-variant-numeric:tabular-nums;transition:border-color .15s}
 .management-card:hover{border-color:var(--border)}header{display:flex;align-items:center;gap:10px}.status-dot{width:8px;height:8px;border-radius:50%;background:var(--muted);flex-shrink:0}.status-dot.online{background:var(--success);box-shadow:0 0 0 4px color-mix(in srgb,var(--success) 10%,transparent)}
 .server-name{min-width:0;flex:1;background:none;border:0;padding:0;color:inherit;font-size:16px;font-weight:650;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.server-name:disabled{opacity:1;cursor:default}header :global(.region-avatar){width:26px;height:23px;background:transparent;border:0}
 .identity-row,.badges,.card-actions,.connection,.protocol,.rates,.rates>span,.metric-label,.heartbeat{display:flex;align-items:center}.identity-row{justify-content:space-between;gap:8px;flex-wrap:wrap}.badges{gap:6px;min-width:0;flex:1;flex-wrap:wrap}.status,.chip,.protocol{padding:4px 7px;border-radius:5px;font-size:10px;white-space:nowrap;background:var(--nested);color:var(--muted)}.status.online{color:var(--success);background:color-mix(in srgb,var(--success) 10%,transparent)}.chip{color:var(--primary);background:color-mix(in srgb,var(--primary) 9%,transparent)}.provider{color:var(--muted);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.card-actions{gap:2px}.card-actions :global(.icon-button){width:27px;height:27px}
 .connection{justify-content:space-between;gap:10px}.address{font-family:var(--font-mono,monospace);color:var(--muted);overflow-wrap:anywhere;min-width:0}.protocol{gap:5px}.versions{display:flex;flex-wrap:wrap;gap:6px 14px;color:var(--muted);font-size:10px;margin-top:-8px}.versions>span{min-width:0;overflow-wrap:anywhere}.versions strong{font-weight:500;color:var(--foreground)}
 .traffic-panel{background:var(--nested);border:1px solid var(--line);border-radius:10px;padding:13px;margin-top:auto}.speed-row,.usage-row,.billing-meta,.reset-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.speed-row{padding-bottom:12px;border-bottom:1px solid var(--line);flex-wrap:wrap}.metric-label{color:var(--muted);gap:6px;white-space:nowrap}.rates{gap:10px;flex-wrap:wrap;font-size:11px}.rates>span{gap:3px}.upload{color:var(--success)}.download{color:var(--primary)}.usage-row{margin-top:12px;flex-wrap:wrap}.usage-row strong{font-size:12px;font-weight:600}.usage-row small{font-size:11px;font-weight:400;color:var(--muted)}.meter{height:5px;background:var(--line);border-radius:9px;margin:10px 0 8px;overflow:hidden}.meter i{display:block;height:100%;background:var(--primary);border-radius:inherit}.meter.warning i{background:var(--warning)}.billing-meta{font-size:10px;color:var(--muted)}.reset-row{font-size:11px;color:var(--muted);margin-top:12px}.gap{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:10px;margin:10px 0 0}.heartbeat{border-top:1px solid var(--line);padding-top:10px;margin-top:12px;gap:5px;font-size:10px;color:var(--muted);flex-wrap:wrap}.heartbeat time{margin-left:auto}footer{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}footer .button{justify-content:center;font-size:12px;min-width:0}
 @media(max-width:480px){.management-card{padding:16px;gap:13px}}
</style>
