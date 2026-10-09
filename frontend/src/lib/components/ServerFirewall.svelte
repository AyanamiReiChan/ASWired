<script lang="ts">
 import {onMount,onDestroy,untrack} from 'svelte';
 import Modal from './Modal.svelte';
 import AppSelect from './Select.svelte';
 import Icon from './Icon.svelte';
 import {api,demo,errorMessage} from '../store.svelte';
 import {createFirewallManager} from '../firewall-state.svelte';
 import {firewallDrafts,firewallPolicyState,firewallTargetKey,firewallTaskLabel,firewallTaskPending,firewallTaskUnknown,prepareFirewallRules,type FirewallDraft,type FirewallSnapshot} from '../firewall';
 let open=$state(false),serverId=$state(''),loadedFor=$state(''),baseline=$state(''),editRevision=$state(0),drafts=$state<FirewallDraft[]>([]),formError=$state('');
 const identity=$derived(demo.user?.role==='admin'?demo.user.id:'');
 const manager=createFirewallManager({request:api,identity:()=>demo.user?.role==='admin'?demo.user.id:'',visible:()=>open&&typeof document!=='undefined'&&!document.hidden});
 const snapshot=$derived(manager.state.snapshot);
 const status=$derived(firewallPolicyState(snapshot,manager.state.verificationPending));
 const dirty=$derived(!!loadedFor&&JSON.stringify(drafts)!==baseline);
 const pending=$derived(firewallTaskPending(snapshot?.task));
 const busy=$derived(manager.state.loading||manager.state.submitting||pending);
 const selectedServer=$derived(demo.data.servers.find(server=>server.id===serverId));
 const targets=$derived(snapshot?.targets??[]);
 const nextTarget=$derived(targets.find(target=>!drafts.some(rule=>firewallTargetKey(rule)===firewallTargetKey(target))));
 const removedRules=$derived((snapshot?.rules??[]).filter(rule=>!drafts.some(draft=>draft.id===rule.id)));
 const needsApply=$derived(!!snapshot&&snapshot.revision>0&&status.tone!=='success');
 function adopt(value:FirewallSnapshot){drafts=firewallDrafts(value.rules);baseline=JSON.stringify(drafts);editRevision=value.revision;loadedFor=`${identity}/${value.serverId}`;formError='';}
 $effect(()=>{const id=serverId,admin=identity,isOpen=open;untrack(()=>{if(isOpen&&admin&&id)void manager.start(id);else{manager.stop();loadedFor='';drafts=[];baseline='';formError='';}});});
 $effect(()=>{const value=snapshot,key=`${identity}/${serverId}`;if(value&&value.serverId===serverId&&(loadedFor!==key||(!dirty&&editRevision!==value.revision)))untrack(()=>adopt(value));});
 onMount(()=>{const visibility=()=>{if(document.hidden)manager.pause();else if(open)void manager.resume();};document.addEventListener('visibilitychange',visibility);return ()=>document.removeEventListener('visibilitychange',visibility);});
 onDestroy(()=>manager.stop());
 function add(){if(busy||!nextTarget||drafts.length>=64)return;drafts=[...drafts,{id:crypto.randomUUID(),name:nextTarget.name,protocol:nextTarget.protocol,port:nextTarget.port,addresses:''}];formError='';}
 function targetOptions(rule:FirewallDraft){const options=targets.map(target=>({value:firewallTargetKey(target),label:`${target.name} · ${target.protocol.toUpperCase()} ${target.port}`}));if(!targets.some(target=>firewallTargetKey(target)===firewallTargetKey(rule)))options.unshift({value:firewallTargetKey(rule),label:`原端口 ${rule.protocol.toUpperCase()} ${rule.port}（已不可选，请移除限制）`});return options;}
 function selectTarget(id:string,key:string){const target=targets.find(item=>firewallTargetKey(item)===key);if(!target)return;drafts=drafts.map(rule=>rule.id===id?{...rule,protocol:target.protocol,port:target.port}:rule);}
 function stamp(value:unknown){if(typeof value!=='string'||!value)return '尚无回报';const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString('zh-CN',{hour12:false}):'时间未知';}
 async function reload(){const id=serverId;if(await manager.reload()&&open&&serverId===id&&manager.state.snapshot)adopt(manager.state.snapshot);}
 async function save(){if(!snapshot||busy)return;formError='';const id=serverId;try{const rules=prepareFirewallRules(drafts,targets);if(await manager.save(rules,editRevision)&&open&&serverId===id&&manager.state.snapshot)adopt(manager.state.snapshot);}catch(cause){formError=errorMessage(cause);}}
</script>

{#if identity}<button class="button" onclick={()=>{serverId=serverId||demo.data.servers[0]?.id||'';open=true;}}><Icon name="shield" size={14}/>端口访问控制</button>{/if}
<Modal bind:open title="端口访问控制 · IP 白名单" description="限制连接代理端口的来源地址，由服务器 Agent 应用并验证。" wide>
 <div class="firewall-body">
  <label class="field">服务器<AppSelect aria-label="访问控制服务器" bind:value={serverId} disabled={manager.state.submitting||dirty} options={[{value:'',label:'选择服务器'},...demo.data.servers.map(server=>({value:server.id,label:server.name}))]}/></label>
  {#if dirty}<p class="hint">有尚未提交的修改。切换服务器前，请保存或放弃当前修改。</p>{/if}
  {#if manager.state.loading&&!snapshot}<div class="firewall-empty" role="status">正在读取端口访问策略…</div>{/if}
  {#if snapshot}
   <section class="firewall-status" aria-label="端口访问控制状态" class:warning={status.tone==='warning'} class:failure={status.tone==='danger'}>
    <div class="status-heading"><strong>{selectedServer?.name??serverId}</strong><span class="state-label" class:success={status.tone==='success'}>{status.label}</span></div>
    <p>主控策略版本 {snapshot.revision} · 节点回报版本 {snapshot.observed?.revision??'—'} · {snapshot.rules.length} 个受限端口</p>
    <p>最近读取：{stamp(snapshot.observed?.checkedAt)}{snapshot.observed?.backend?` · ${snapshot.observed.backend}`:''}</p>
    {#if snapshot.task}<p>最近任务：{firewallTaskLabel(snapshot.task)} · <a class="quiet-link" href={`/tasks?detail=${encodeURIComponent(snapshot.task.id)}`}>查看执行记录</a></p>{/if}
    {#if snapshot.task?.error}<p class="error" role="alert">{snapshot.task.error}</p>{/if}
    {#if snapshot.observed?.lastError}<p class="error" role="alert">{snapshot.observed.lastError}</p>{/if}
    {#if !snapshot.capable}<p class="hint">此 Agent 尚未提供端口访问控制能力。请先升级 Agent，并确认节点运行 Linux 且已安装 nftables；已有策略不会因本页打开而自动生效。</p>{:else if snapshot.observed?.supported===false}<p class="hint">Agent 当前无法应用防火墙。请检查 Linux、nftables 和运行权限，再读取实际状态。</p>{/if}
    {#if snapshot.observed&&snapshot.observed.applied&&snapshot.observed.revision!==snapshot.revision}<p class="hint">节点仍在使用另一版本的策略，当前保存的规则尚未确认生效。</p>{/if}
   </section>
   <div class="firewall-notes"><p>只限制下面选中的代理端口，未添加规则的端口保持原有访问策略。当前可选择受管的原生 TCP REALITY 入站。</p><p>链式代理请填写<strong>连接此服务器的上一跳公网出口 IP</strong>。IPv4 与 IPv6 均按白名单放行；未列出的来源会被拒绝。</p><p>策略独立于 Xray 用户凭据。更换或删除受保护的监听端口前，须先在这里解除该端口限制。</p></div>
   <div class="rule-heading"><h3>允许连接的来源</h3><button class="button small" disabled={busy||!nextTarget||drafts.length>=64} onclick={add}><Icon name="plus" size={14}/>添加端口规则</button></div>
   {#each drafts as rule,index (rule.id)}
    <section class="firewall-rule" aria-label={`访问规则 ${index+1}`}>
     <div class="rule-heading"><strong>规则 {index+1}</strong><button class="button small danger" disabled={busy} onclick={()=>{drafts=drafts.filter(item=>item.id!==rule.id);formError='';}}>移除端口限制</button></div>
     <div class="form-grid"><label class="field">规则名称<input aria-label={`规则 ${index+1} 名称`} bind:value={rule.name} maxlength="100" disabled={busy}/></label><label class="field">保护的入站端口<AppSelect aria-label={`规则 ${index+1} 入站端口`} value={firewallTargetKey(rule)} onchange={value=>selectTarget(rule.id,value)} options={targetOptions(rule)} disabled={busy}/></label></div>
     {#if !targets.some(target=>firewallTargetKey(target)===firewallTargetKey(rule))}<p class="error">该端口已不在可保护的入站中。规则仍保留，请移除后保存。</p>{/if}
     <label class="field">允许的来源 IP / CIDR<textarea aria-label={`规则 ${index+1} 允许的来源 IP`} bind:value={rule.addresses} disabled={busy} rows="4" spellcheck="false" placeholder={'每行一个，或用逗号分隔\n203.0.113.10\n2001:db8::10/128'}></textarea></label>
     <p class="hint">最多 128 个地址，填写真实来源地址。至少允许一个地址；清空列表不会解除限制。</p>
    </section>
   {:else}<div class="firewall-empty">尚未设置端口白名单。添加规则并保存后，才会限制所选端口。</div>{/each}
   {#if !targets.length}<p class="hint">暂时没有可选择的受管 TCP REALITY 入站。先发布入站并升级 Agent，再重新载入。</p>{/if}
   {#if removedRules.length}<p class="remove-notice" role="status">待解除：{removedRules.map(rule=>`${rule.protocol.toUpperCase()} ${rule.port}`).join('、')}。保存并应用后，这些端口不再受本页白名单限制。</p>{/if}
   {#if dirty&&snapshot.revision!==editRevision}<p class="error" role="alert">其他操作已更新主控策略。请放弃当前修改并重新载入，再编辑最新版本。</p>{/if}
   {#if snapshot.observed}<details class="observed-rules"><summary>查看节点最近回报的规则（{snapshot.observed.rules.length} 条）</summary>{#each snapshot.observed.rules as rule}<div><strong>{rule.name} · {rule.protocol.toUpperCase()} {rule.port}</strong><p>{rule.allowedCidrs.join('、')}</p></div>{:else}<p class="hint">节点最近回报中没有受限端口。</p>{/each}</details>{/if}
  {/if}
  {#if manager.state.notice}<p class="hint" role="status">{manager.state.notice}</p>{/if}
  {#if formError||manager.state.error}<p class="error" role="alert">{formError||manager.state.error}</p>{/if}
  <div class="firewall-actions"><button class="button" onclick={()=>open=false}>关闭</button><button class="button" disabled={!serverId||manager.state.loading||manager.state.submitting} onclick={reload}>{dirty?'放弃修改并重新载入':'重新载入'}</button><button class="button" disabled={!snapshot?.capable||busy||manager.state.verificationPending} onclick={()=>manager.refresh()}>读取实际状态</button><button class="button primary" disabled={!snapshot?.capable||busy||manager.state.verificationPending||firewallTaskUnknown(snapshot?.task)||(!dirty&&!needsApply)||!!snapshot&&snapshot.revision!==editRevision} onclick={save}>{manager.state.submitting?'正在提交…':!dirty&&needsApply?'重新应用当前策略':'保存并应用'}</button></div>
 </div>
</Modal>

<style>
 .firewall-body{display:grid;gap:1rem}.firewall-body .hint{font-size:.73rem;line-height:1.7;margin:0}.firewall-status,.firewall-rule{border:1px solid var(--line);border-radius:.6rem;padding:1rem;background:var(--nested);min-width:0}.firewall-status.warning{border-color:color-mix(in srgb,var(--warning) 40%,var(--line))}.firewall-status.failure{border-color:var(--danger)}.status-heading,.rule-heading{display:flex;align-items:center;justify-content:space-between;gap:.75rem}.status-heading strong{overflow-wrap:anywhere}.state-label{font-size:.72rem;color:var(--muted);flex-shrink:0}.state-label.success{color:var(--success)}.firewall-status p{font-size:.73rem;line-height:1.7;margin:.4rem 0 0;color:var(--muted);overflow-wrap:anywhere}.firewall-status .error,.error{color:var(--danger);font-size:.75rem;line-height:1.7;margin:0;overflow-wrap:anywhere}.firewall-notes{display:grid;gap:.35rem;color:var(--muted);font-size:.73rem;line-height:1.7}.firewall-notes p{margin:0}.firewall-notes strong{color:var(--foreground);font-weight:550}.rule-heading h3{font-size:.93rem;margin:0}.rule-heading>strong{font-size:.8rem}.firewall-rule{display:grid;gap:1rem;background:var(--card)}.firewall-rule textarea{resize:vertical;min-height:6rem;line-height:1.6;font-family:monospace;font-size:.8rem}.firewall-empty{padding:1.5rem 1rem;border:1px dashed var(--line);border-radius:.6rem;text-align:center;color:var(--muted);font-size:.78rem;line-height:1.7}.remove-notice{margin:0;border:1px solid color-mix(in srgb,var(--warning) 45%,var(--line));padding:.8rem;border-radius:.5rem;color:var(--warning);font-size:.75rem;line-height:1.7}.observed-rules{font-size:.73rem;line-height:1.7;color:var(--muted)}.observed-rules summary{cursor:pointer}.observed-rules>div{padding:.65rem 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere}.observed-rules strong{color:var(--foreground);font-weight:550}.observed-rules p{margin:.3rem 0 0}.firewall-actions{display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:1rem}.firewall-actions .button{font-size:.75rem}@media(max-width:600px){.firewall-status,.firewall-rule{padding:.8rem}.status-heading{align-items:flex-start}.firewall-actions .button{flex:1;min-width:40%}.rule-heading{align-items:flex-start}.rule-heading .button{font-size:.7rem}.firewall-rule .form-grid{grid-template-columns:1fr}}
</style>
