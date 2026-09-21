<script lang="ts">
 import {onDestroy} from 'svelte';
 import Modal from './Modal.svelte';import AgentInstall from './AgentInstall.svelte';
 import AppSelect from './Select.svelte';
 import {demo,saveRow,api,errorMessage,refreshState} from '../store.svelte';
 import {newServerForm,serverOnboardingPayload} from '../server-onboarding';import type {Row} from '../data';
 let {open=$bindable(false)}=$props<{open?:boolean}>();
 let form=$state(newServerForm(crypto.randomUUID())),saved=$state<Row|null>(null),busy=$state(false),error=$state(''),enrollment=$state<Record<string,any>|null>(null),stage=$state<'settings'|'install'>('settings');
 let disposed=false;onDestroy(()=>disposed=true);
 const online=$derived(saved&&demo.data.servers?.find(row=>row.id===saved?.id)?.status==='在线');
 async function load(){if(!saved||busy)return;busy=true;error='';try{const data=await api(`/api/servers/${encodeURIComponent(saved.id)}/enrollment`);if(!disposed)enrollment=data;}catch(cause){if(!disposed)error=errorMessage(cause);}finally{busy=false;}}
 async function generate(){
  if(busy)return;busy=true;error='';
  try{
   if(!String(form.name).trim()||!String(form.address).trim())throw new Error('请填写名称和服务器地址');
   const row=await saveRow('servers',{...serverOnboardingPayload(form),...(saved?{version:saved.version}:{})});
   if(disposed)return;saved=row;stage='install';enrollment=null;
  }catch(cause){if(!disposed)error=errorMessage(cause);}finally{busy=false;}
  if(stage==='install'&&!disposed)await load();
 }
 async function checkOnline(){if(busy)return;busy=true;error='';try{await refreshState(true);}catch(cause){error=errorMessage(cause);}finally{busy=false;}}
</script>
<Modal bind:open title="新增服务器" description="先设置服务器，再复制命令完成接入。" wide>
 <ol class="setup-steps"><li class:current={stage==='settings'}><span>1</span>配置服务器</li><li class:current={stage==='install'}><span>2</span>复制命令部署</li></ol>
 {#if stage==='settings'}
 <form onsubmit={event=>{event.preventDefault();generate();}}>
  <fieldset disabled={busy} class="setup-fields">
   <div class="form-grid">
    <label class="field">服务器名称 *<input required bind:value={form.name} placeholder="例如 Tokyo-01"/></label>
    <label class="field">服务器地址 *<input required bind:value={form.address} placeholder="IP 地址或域名"/></label>
    <label class="field">连接模式<AppSelect aria-label="连接模式" bind:value={form.connection} options={['自动','WebSocket','HTTP','轮询']} disabled={busy}/></label>
    {#if ['自动','HTTP'].includes(form.connection)}<label class="field">Agent 管理端口<input type="number" min="1" max="65535" step="1" bind:value={form.agentPort}/></label><label class="field">Agent 管理 URL（选填）<input type="url" bind:value={form.agentUrl} placeholder="留空使用服务器地址与管理端口"/></label>{/if}
   </div>
   <p class="hint">自动按 WebSocket → HTTP → 轮询回退。HTTP 需要主控能访问 Agent 管理端口；WebSocket 和轮询由 Agent 主动连接。</p>
   <div class="section-label">资产信息 <span>选填，可稍后修改</span></div>
   <div class="form-grid">
    <label class="field">地区<input bind:value={form.region} placeholder="例如 日本 / JP"/></label>
    <label class="field">服务商<input bind:value={form.provider} placeholder="服务商名称"/></label>
    <label class="field">月流量额度 / GB<input type="number" min="0" step="any" bind:value={form.limit} placeholder="留空表示未设置"/></label>
    <label class="field">月成本 / 元<input type="number" min="0" step="any" bind:value={form.cost} placeholder="留空表示未设置"/></label>
    <label class="field">到期日<input type="date" bind:value={form.expires}/></label>
    <label class="field">备注<input bind:value={form.description} placeholder="可选"/></label>
   </div>
  </fieldset>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="modal-actions"><button type="button" class="button" disabled={busy} onclick={()=>open=false}>取消</button><button class="button primary" type="submit" disabled={busy}>{busy?'保存中…':'保存并生成安装命令'}</button></div>
 </form>
 {:else}
  <div class="node-summary"><div><strong>{saved?.name}</strong><p class="hint">{saved?.address} · {saved?.connection}</p></div><span class:connected={online} class="connection-status">{online?'已连接':'等待首次接入'}</span></div>
  <AgentInstall {enrollment} {busy} onrefresh={load}/>
  {#if error}<p class="error space-top" role="alert">{error}</p>{/if}
  <div class="modal-actions"><button type="button" class="button" disabled={busy} onclick={()=>{stage='settings';enrollment=null;error='';}}>修改配置</button><button type="button" class="button" disabled={busy} onclick={checkOnline}>检查连接</button><button type="button" class="button primary" onclick={()=>open=false}>完成</button></div>
 {/if}
</Modal>
<style>
 .node-summary :global(.hint){padding:0;border:0;background:none}
 .setup-steps{display:flex;gap:2rem;padding:0 0 1.2rem;margin:0 0 1.2rem;border-bottom:1px solid var(--line);list-style:none;font-size:.85rem;color:var(--muted)}.setup-steps li{display:flex;align-items:center;gap:.6rem}.setup-steps span{display:grid;place-items:center;width:1.6rem;height:1.6rem;border:1px solid var(--line);border-radius:50%}.setup-steps .current{color:var(--foreground)}.current span{background:var(--primary);color:var(--background);border-color:transparent}.setup-fields{padding:0;margin:0;border:0;min-width:0;display:grid;gap:1.3rem}.node-summary{display:flex;align-items:center;justify-content:space-between;gap:1rem;background:var(--nested);padding:1rem;border:1px solid var(--line);border-radius:.7rem}.section-label{font-size:.85rem;border-top:1px solid var(--line);padding-top:1.2rem}.section-label span{color:var(--muted);font-size:.75rem;margin-left:.5rem}.node-summary{margin-bottom:1.2rem}.connection-status{font-size:.8rem;color:var(--muted)}.connected{color:var(--success)}@media(max-width:600px){.setup-steps{gap:1rem}.form-grid{grid-template-columns:1fr}}
</style>
