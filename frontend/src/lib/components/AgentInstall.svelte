<script lang="ts">
 import ExpandableValue from './ExpandableValue.svelte';
 import {copy,download} from '../store.svelte';
 let {enrollment,busy=false,onrefresh}=$props<{enrollment:Record<string,any>|null;busy?:boolean;onrefresh:()=>void}>();
 const install=$derived(enrollment?.installation);
</script>
<section class="install-panel" aria-label="Agent 安装命令">
 <div class="install-heading"><div><strong>在服务器上运行</strong><p class="hint">Linux · systemd · 内嵌 Xray</p></div><button class="button small" type="button" disabled={busy} onclick={onrefresh}>{busy?'生成中…':'重新生成命令'}</button></div>
 {#if enrollment}
  {#if install?.available}
   <p class="hint">{install.note}</p>
   {#if install.localOnly}<p class="local-note" role="note">当前是本地主控，命令中的 127.0.0.1 / localhost 仅在本机可达。远程部署前，需要为主控配置目标服务器可访问的地址。</p>{/if}
   <pre class="install-command"><code>{install.command}</code></pre>
   <div class="install-footer"><span class="hint">有效至 {new Date(install.expiresAt).toLocaleTimeString()} · {install.platforms.join(' / ')}</span><button class="button primary" type="button" onclick={()=>copy(install.command)}>复制安装命令</button></div>
   <p class="hint">命令包含此服务器的临时接入凭据，请勿分享。已有 Agent 的机器请使用维护流程，安装器不会覆盖原有配置。</p>
  {:else}<p class="hint space-top" role="status">{install?.note??'当前主控尚不支持生成安装命令，请更新主控。'}</p>{/if}
  <details class="space-top"><summary>手动接入配置</summary><p class="hint space-top">用于手动部署或排查连接；包含服务器凭据。</p><ExpandableValue value={enrollment.config} label="Agent 配置" force/><button type="button" class="button small space-top" onclick={()=>download('aswired-agent.json',JSON.stringify(enrollment.config,null,2),'application/json')}>下载配置</button></details>
 {:else}<p class="hint space-top">{busy?'正在生成安装命令…':'点击重新生成命令，获取当前服务器的接入配置。'}</p>{/if}
</section>
<style>
 .install-panel :global(.hint){padding:0;border:0;background:none}
 .install-panel{display:grid;gap:1rem}.install-heading,.install-footer{display:flex;align-items:center;justify-content:space-between;gap:1rem}.install-command{margin:0;padding:1rem;background:var(--background);border:1px solid var(--line);border-radius:.7rem;font-size:.8rem;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;max-height:13rem;overflow:auto}.local-note{padding:.75rem 1rem;border-left:2px solid var(--warning);background:var(--nested);font-size:.8rem;color:var(--muted);border-radius:.35rem}summary{cursor:pointer;color:var(--muted);font-size:.85rem}@media(max-width:600px){.install-footer{align-items:stretch;flex-direction:column}}
</style>
