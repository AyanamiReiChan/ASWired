<script lang="ts">
 import type {Snippet} from 'svelte';
 import type {Row} from '../data';
 import Icon from './Icon.svelte';
 import AppSelect from './Select.svelte';
 import CountryBadge from './CountryBadge.svelte';
 import {nonnegative,overviewBytes,serverQuota} from '../overview';
 import {monthlyTrafficReset,trafficDirection} from '../server-display';
 let {server,hideIP=false,onview,onconfig,onagent,onconnection,actions}:{server:Row;hideIP?:boolean;onview?:()=>void;onconfig?:()=>void;onagent?:()=>void;onconnection?:(mode:string)=>Promise<void>;actions?:Snippet}=$props();
 let changing=$state(false);
 const online=$derived(['在线','告警'].includes(server.status));
 const live=$derived(server.probeOnline===true);
 const quota=$derived(serverQuota(server));
 const reset=$derived(monthlyTrafficReset(server));
 const configured=$derived(({auto:'自动',pull:'轮询',http:'HTTP',websocket:'WebSocket'} as Record<string,string>)[String(server.connection)]??server.connection??'WebSocket');
 const desired=$derived(({自动:'auto',轮询:'pull',HTTP:'http',WebSocket:'websocket'} as Record<string,string>)[configured]);
 const pending=$derived(server.connectionSwitchSupported&&server.appliedConnection&&server.appliedConnection!==desired);
 const coreRunning=$derived(online&&server.agentState?.core?.running===true);
 const addresses=$derived([...new Set([server.address,server.ipv4,server.ipv6].filter((value):value is string=>typeof value==='string'&&!!value.trim()))]);
 function heartbeat(value:unknown){
  if(!value)return '尚未收到心跳';
  const date=new Date(typeof value==='number'?(value<1e12?value*1000:value):String(value));
  return Number.isNaN(date.getTime())?'尚未收到心跳':date.toLocaleString('zh-CN',{hour12:false});
 }
 async function changeConnection(mode:string){if(!onconnection||changing||mode===configured)return;changing=true;try{await onconnection(mode);}finally{changing=false;}}
</script>

<tr aria-label={`${server.name} 服务器`}>
 <td class="name-cell">
  <div class="name-line"><span class="status-dot" class:online></span><button class="server-name" title={server.name} onclick={onview} disabled={!onview}>{server.name}</button><CountryBadge region={server.region} code={server.code} observedRegion={server.observation?.region}/><span class="status" class:online>{server.status??'待接入'}</span></div>
  <div class="identity-meta"><span class="core-mode">内嵌 Xray</span><time title={heartbeat(server.lastSeen)}>心跳：{heartbeat(server.lastSeen)}</time></div>
 </td>
 <td class="connection-cell">
  {#if onconnection}{#key `${server.id}:${configured}:${changing}`}<AppSelect aria-label={`${server.name} 列表连接模式`} value={configured} options={['自动','WebSocket','HTTP','轮询']} disabled={changing} onchange={changeConnection}/>{/key}{:else}<span>{configured}</span>{/if}
  <small class:pending title={pending?'等待 Agent 应用连接模式':'当前实际通信通道'}>{pending?'待应用':online?server.activeConnection??'等待上报':'未连接'}</small>
 </td>
 <td class="address-cell">{#if hideIP}<span>•••.•••.•••.•••</span>{:else}{#each addresses as address}<span title={address}>{address}</span>{:else}<span>未设置地址</span>{/each}{/if}</td>
 <td class="rates-cell"><span class="upload" title="上传速率"><Icon name="up" size={12}/>{overviewBytes(live?nonnegative(server.upload??server.observation?.network_tx_per_second):null,true)}</span><span class="download" title="下载速率"><Icon name="down" size={12}/>{overviewBytes(live?nonnegative(server.download??server.observation?.network_rx_per_second):null,true)}</span></td>
 <td class="traffic-cell">
  <div class="usage" title={trafficDirection(server)}>{overviewBytes(quota.used)} <span>/ {quota.unlimited?'不限流量':overviewBytes(quota.limit)}</span>{#if quota.gap}<span class="gap" title={server.merchantTraffic?.gapReason??'统计不完整'}><Icon name="warning" size={12}/></span>{/if}</div>
  <div class="quota-meter" class:warning={(quota.percent??0)>=90} class:unlimited={quota.unlimited&&quota.used!==null} role="meter" aria-label={`${server.name} 账期流量使用率`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={quota.percent===null?undefined:Math.min(100,quota.percent)} aria-valuetext={quota.percent===null?(quota.unlimited?'不限流量':'未配置账期或等待采样'):`${quota.percent.toFixed(1)}%`}><i style={`width:${quota.unlimited&&quota.used!==null?100:Math.min(100,quota.percent??0)}%`}></i></div>
  <small title={reset??undefined}>{server.merchantTraffic?.configured?`每月 ${server.merchantTraffic.resetDay} 日重置`:reset??'未配置账期'}</small>
 </td>
 <td class="services-cell"><div class="services"><span class="service" class:running={coreRunning} title={`Xray ${server.core??'版本未上报'} · ${!online?'状态未知':server.agentState?.core?.running===true?'运行中':server.agentState?.core?.running===false?'已停止':'状态未上报'}`}><span class="service-dot"></span>Xray <span class="version">{server.core??'未上报'}</span></span><span class="service agent" class:running={online} title={`Agent ${server.agentVersion??'版本未上报'}`}><Icon name="server" size={12}/><span class="version">{server.agentVersion??'未上报'}</span></span></div></td>
 <td class="actions-cell"><div class="server-actions">{#if onconfig}<button class="icon-button" aria-label={`Xray 配置 ${server.name}`} title="Xray 配置" onclick={onconfig}><Icon name="code" size={15}/></button>{/if}{#if onagent}<button class="icon-button" aria-label={`Agent 设置 ${server.name}`} title="Agent 设置与接入" onclick={onagent}><Icon name="settings" size={15}/></button>{/if}{#if actions}{@render actions()}{/if}</div></td>
</tr>

<style>
 tr{height:78px}td{padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:middle;font-size:12px;font-variant-numeric:tabular-nums;white-space:normal}tr:last-child td{border-bottom:0}tr:hover td{background:color-mix(in srgb,var(--foreground) 3%,transparent)}
 .name-line{display:flex;align-items:center;gap:8px;min-width:0}.status-dot,.service-dot{width:7px;height:7px;flex-shrink:0;border-radius:50%;background:var(--muted)}.status-dot.online{background:var(--success)}.server-name{padding:0;border:0;background:none;color:var(--foreground);font-size:13px;font-weight:600;text-align:left;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.server-name:disabled{opacity:1;cursor:default}.name-line :global(.region-avatar){width:20px;height:16px;background:none;border:0;flex-shrink:0}.status{margin-left:auto;flex-shrink:0;font-size:10px;padding:3px 6px;border-radius:3px;color:var(--muted);background:var(--nested)}.status.online{color:var(--success);background:color-mix(in srgb,var(--success) 10%,transparent)}.identity-meta{display:flex;align-items:center;gap:8px;padding-left:15px;margin-top:6px;color:var(--muted);font-size:10px;white-space:nowrap}.identity-meta time{overflow:hidden;text-overflow:ellipsis}.core-mode{color:var(--primary);flex-shrink:0}
 .connection-cell :global(.app-select-trigger){height:29px;min-height:29px;padding:3px 7px;font-size:12px;width:100%;min-width:0}.connection-cell small{display:block;margin-top:5px;font-size:10px;color:var(--muted)}.connection-cell small.pending{color:var(--warning)}.address-cell{font-family:var(--font-mono,monospace);color:var(--muted);font-size:11px}.address-cell>span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.8}.rates-cell>span{display:flex;align-items:center;gap:3px;line-height:1.8;white-space:nowrap}.upload{color:var(--success)}.download{color:var(--primary)}
 .usage{display:flex;align-items:center;gap:4px;white-space:nowrap;font-size:11px}.usage>span{color:var(--muted)}.usage .gap{margin-left:auto;color:var(--warning)}.quota-meter{height:5px;border-radius:3px;overflow:hidden;background:var(--line);margin:7px 0 5px}.quota-meter i{display:block;height:100%;background:var(--success);border-radius:inherit}.quota-meter.warning i{background:var(--warning)}.quota-meter.unlimited i{background:var(--primary);opacity:.5}.traffic-cell small{color:var(--muted);font-size:10px}
 .services{display:flex;align-items:flex-start;gap:5px;flex-wrap:wrap}.service{display:inline-flex;align-items:center;gap:5px;max-width:100%;padding:4px 6px;border-radius:4px;color:var(--muted);background:var(--nested);font-size:10px;white-space:nowrap}.service.running{color:var(--success);background:color-mix(in srgb,var(--success) 9%,transparent)}.service.running .service-dot{background:var(--success)}.service.agent.running{color:var(--primary);background:color-mix(in srgb,var(--primary) 9%,transparent)}.version{overflow:hidden;text-overflow:ellipsis;min-width:0}.server-actions{display:flex;align-items:center;justify-content:flex-end;gap:3px;white-space:nowrap}.server-actions :global(.icon-button){width:26px;height:28px;padding:4px;border:1px solid var(--line);border-radius:4px;flex-shrink:0}.server-actions :global(.icon-button:hover){background:var(--nested);border-color:var(--border)}.server-actions :global(.delete-server){color:var(--danger,var(--error,#e56a78))}
</style>
