<script lang="ts">
 import {onMount} from 'svelte';
 import {api, demo, errorMessage, runAction} from '../store.svelte';
 let {channel = '稳定版'} = $props<{channel?: string}>();
 type UpdateStatus = {supported:boolean; reason?:string; phase:string; version?:string; message?:string; backup?:string};
 type Release = {version:string; url:string; available:boolean; channel:string; updateStatus:UpdateStatus};
 let release = $state<Release|null>(null), status = $state<UpdateStatus|null>(null), busy = $state(false), error = $state(''), confirmed = $state(false), current = $state(demo.version), reconnecting = $state(false);
 const pending = $derived(status?.phase === 'queued' || status?.phase === 'updating');
 const selectedChannel = $derived(channel === '预发布' ? 'prerelease' : 'stable');
 const applicable = $derived(release?.available && release.channel === selectedChannel);
 const labels:Record<string,string> = {idle:'尚无升级任务',queued:'等待更新服务',updating:'升级进行中',completed:'升级完成',failed:'升级失败'};
 let disposed = false, timer: ReturnType<typeof setTimeout>|undefined;
 async function refresh() {
  try {
   const result = await api<{current:string;updateStatus:UpdateStatus}>('/api/system/update');
   if(disposed)return;
   current=result.current;demo.version=result.current;status=result.updateStatus;if(reconnecting)error='';reconnecting=false;
  } catch(cause) {if(!disposed){reconnecting=true;error=pending?'主控暂时无法连接，正在等待服务恢复；这不代表升级成功。':errorMessage(cause);}}
 }
 async function poll() {await refresh();if(!disposed&&(pending||reconnecting))timer=setTimeout(poll,5000);}
 onMount(()=>{poll();return()=>{disposed=true;if(timer)clearTimeout(timer);};});
 async function check() {
  if(busy||pending)return;busy=true;error='';confirmed=false;
  try {const result=await runAction('system.update',undefined,undefined,{channel:selectedChannel});if(!disposed){release=result;status=result.updateStatus;}}
  catch(cause){if(!disposed)error=errorMessage(cause);}finally{busy=false;}
 }
 async function install() {
  if(busy||pending||!applicable||!release||!confirmed||!status?.supported)return;
  busy=true;error='';
  try {const result=await runAction('system.update',undefined,undefined,{apply:true,version:release.version,channel:release.channel});if(!disposed){status=result.updateStatus;confirmed=false;if(timer)clearTimeout(timer);timer=setTimeout(poll,3000);}}
  catch(cause){if(!disposed){error=errorMessage(cause);await refresh();}}
  finally{busy=false;}
 }
</script>

<p class="hint">主控版本：{current}</p>
<div class="actions space-top"><button class="button" disabled={busy||pending} onclick={check}>检查可用版本</button><button class="button" disabled={busy} onclick={refresh}>刷新升级状态</button></div>
{#if status}
 <p class="hint" role="status">{labels[status.phase]??status.phase}{status.version?` · ${status.version}`:''}{status.message?` · ${status.message}`:''}</p>
 {#if !status.supported}<p class="hint">{status.reason}</p>{/if}
 {#if status.backup}<p class="hint">升级备份：{status.backup}</p>{/if}
{/if}
{#if release}
 <a class="button space-top" href={release.url} target="_blank" rel="noopener noreferrer">查看 {release.version} 发行说明</a>
 {#if applicable && status?.supported && !pending && current!==release.version}
  <p class="hint">将一起更新主控、网站和整合版 Komari。下载与校验后生成备份，再短暂重启服务；远端 Agent 单独升级。</p>
  <label class="tag space-top"><input type="checkbox" bind:checked={confirmed} disabled={busy}/>确认升级至 {release.version} 并允许服务短暂重启</label>
  <button class="button primary space-top" disabled={busy||!confirmed} onclick={install}>下载并升级</button>
 {:else if !release.available}<p class="hint">当前已是最新版本。</p>{/if}
{/if}
{#if error}<p class="error" role="alert">{error}</p>{/if}
