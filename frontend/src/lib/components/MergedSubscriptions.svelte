<script lang="ts">
 import {onMount, onDestroy} from 'svelte';
 import Icon from './Icon.svelte';
 import Badge from './Badge.svelte';
 import {api, copy, demo, errorMessage, toast} from '../store.svelte';
 import {mergedSubscriptionView, mergedSubscriptionPayload, mergedSubscriptionURL, mergedSubscriptionAvailability, sameSubscriptionSelection, type MergedSubscriptionView} from '../member-subscriptions';

 let saved = $state<MergedSubscriptionView | null>(null), enabled = $state(false), scope = $state('all'), selected = $state<string[]>([]);
 let loading = $state(true), busy = $state(false), error = $state('');
 let generation = 0, controller: AbortController | undefined;
 const selection = $derived(scope === 'all' ? null : selected);
 const dirty = $derived(!!saved && (enabled !== saved.enabled || !sameSubscriptionSelection(selection, saved.subscriptionIds)));
 const missing = $derived(scope === 'selected' ? selected.filter(id => !saved?.subscriptions.some(subscription => subscription.id === id)) : []);
 const chosen = $derived(saved?.subscriptions.filter(subscription => selection === null || selection.includes(subscription.id)) ?? []);
 const ready = $derived(!!saved?.enabled && !dirty && !busy && !loading);
 const clashURL = $derived(ready ? mergedSubscriptionURL(saved?.url ?? '', 'clash', window.location.origin) : '');
 const singboxURL = $derived(ready ? mergedSubscriptionURL(saved?.url ?? '', 'singbox', window.location.origin) : '');
 const invalid = $derived(enabled && (scope === 'selected' && selected.length === 0 || missing.length > 0));

 function accept(value: unknown) {
  saved = mergedSubscriptionView(value); enabled = saved.enabled;
  scope = saved.subscriptionIds === null ? 'all' : 'selected';
  selected = saved.subscriptionIds === null ? saved.subscriptions.map(subscription => subscription.id) : [...saved.subscriptionIds];
 }
 async function load() {
  if (busy) return;
  controller?.abort(); controller = new AbortController();
  const request = ++generation, owner = demo.user?.id;
  loading = true; error = '';
  try { const result = await api('/api/account/merged-subscription', {signal: controller.signal}); if (request === generation && owner === demo.user?.id) accept(result); }
  catch (cause) { if (request === generation && owner === demo.user?.id) error = errorMessage(cause); }
  finally { if (request === generation && owner === demo.user?.id) loading = false; }
 }
 async function save(rotate = false) {
  if (busy || loading || !saved) return;
  const request = ++generation, owner = demo.user?.id;
  busy = true; error = '';
  try {
   const payload = mergedSubscriptionPayload(enabled, selection, saved.subscriptions, rotate, saved.subscriptionIds);
   const result = await api('/api/account/merged-subscription', {method: 'PUT', body: JSON.stringify(payload)});
   if (request !== generation || owner !== demo.user?.id) return;
   accept(result); toast(rotate ? '合并订阅链接已重置，旧链接已失效' : '合并订阅设置已保存');
  } catch (cause) { if (request === generation && owner === demo.user?.id) error = errorMessage(cause); }
  finally { if (request === generation && owner === demo.user?.id) busy = false; }
 }
 function changeScope(value: string) { scope = value; }
 onMount(() => { void load(); });
 onDestroy(() => { generation++; controller?.abort(); });
</script>

<section class="card padded space-top merged-subscriptions" aria-busy={loading || busy}>
 <div class="section-head"><div><h2>合并套餐订阅</h2><p class="muted">把多个套餐的线路放进同一个订阅链接。各套餐保留自己的凭据、有效期和流量计量规则。</p></div><button class="icon-button" aria-label="刷新合并订阅" title="刷新合并订阅" disabled={loading || busy || dirty} onclick={load}><Icon name="refresh"/></button></div>
 {#if loading}<p class="hint space-top" role="status">正在读取你的套餐…</p>{:else if saved}
  <form onsubmit={event => { event.preventDefault(); void save(); }}>
   <label class="tag space-top"><input type="checkbox" bind:checked={enabled} disabled={busy}/>启用合并订阅</label>
   <fieldset class="merge-scopes" disabled={busy}>
    <legend>合并范围</legend>
    <label><input type="radio" name="merged-scope" value="all" checked={scope === 'all'} onchange={() => changeScope('all')}/><span>自动合并全部套餐<small>以后新增的套餐也会自动加入。</small></span></label>
    <label><input type="radio" name="merged-scope" value="selected" checked={scope === 'selected'} onchange={() => changeScope('selected')}/><span>只合并勾选的套餐<small>新增套餐后，在这里勾选并保存。</small></span></label>
   </fieldset>
   <div class="merge-list">
    {#each saved.subscriptions as subscription (subscription.id)}
     <label class="merge-entry" class:unavailable={!subscription.active}>
      <input type="checkbox" aria-label={`合并 ${subscription.plan || subscription.name}`} checked={scope === 'all' || selected.includes(subscription.id)} disabled={busy || scope === 'all'} onchange={event => { selected = event.currentTarget.checked ? [...selected, subscription.id] : selected.filter(id => id !== subscription.id); }}/>
      <span class="merge-identity"><strong>{subscription.plan || subscription.name}</strong><small>{subscription.name} · {subscription.expires ? `到期 ${subscription.expires}` : '长期有效'}</small>{#if !subscription.active}<small>{subscription.unavailableReason || '当前不可输出，恢复有效后会自动加入'}</small>{/if}</span>
      <Badge {...mergedSubscriptionAvailability(subscription)}/>
     </label>
    {:else}<p class="empty">尚未绑定套餐，请联系管理员添加；一个用户可以拥有多个不同套餐。</p>{/each}
    {#each missing as id}<label class="merge-entry unavailable"><input type="checkbox" checked disabled={busy || scope === 'all'} onchange={() => { selected = selected.filter(value => value !== id); }}/><span>已删除或不可访问的套餐<small>取消勾选后保存，不会自动替换为其他套餐。</small></span></label>{/each}
   </div>
   <div class="merge-footer"><p class="hint">已选择 {chosen.length} 个套餐，当前可用 {chosen.filter(subscription => subscription.active).length} 个。{scope === 'all' ? '仅输出当时有效的套餐线路。' : '各套餐流量额度不会因合并而叠加或转移。'}</p><button class="button primary" disabled={busy || !dirty || invalid}>{busy ? '保存中…' : '保存合并设置'}</button></div>
   {#if invalid}<p class="hint">{missing.length ? '请移除已不可访问的套餐选项。' : '请至少选择一个套餐，或关闭合并订阅。'}</p>{/if}
   {#if dirty}<p class="hint">修改尚未保存，保存后即可复制合并订阅链接。</p>{/if}
  </form>
  {#if saved.enabled}<div class="actions space-top"><button class="button primary" disabled={!clashURL} onclick={() => copy(clashURL)}><Icon name="copy"/>复制 Clash 链接</button><button class="button" disabled={!singboxURL} onclick={() => copy(singboxURL)}>复制 sing-box 链接</button>{#if clashURL}<a class="button" href={clashURL} download="ASWired-merged.yaml">下载配置</a>{/if}<button class="button" disabled={!ready} onclick={() => save(true)}>重置链接</button></div><p class="hint">相同节点按套餐分别列出，并标注套餐名称。过期、停用或无法继续使用的套餐不会输出；重置链接后旧链接立即失效。</p>{/if}
 {/if}
 {#if error}<p class="error space-top" role="alert">{error}</p>{/if}
</section>

<style>
 .merged-subscriptions{min-width:0}.section-head{align-items:flex-start}.section-head>div{min-width:0}.section-head .icon-button{flex-shrink:0}.merge-scopes{display:flex;flex-wrap:wrap;gap:16px 28px;margin:20px 0 14px;padding:0;border:0}.merge-scopes legend{font-size:13px;font-weight:600;margin-bottom:10px}.merge-scopes label,.merge-entry{display:flex;align-items:flex-start;gap:10px}.merge-scopes input,.merge-entry input{flex-shrink:0;margin-top:4px}.merge-scopes span{font-size:13px}.merge-scopes small,.merge-entry small{display:block;color:var(--muted);font-size:12px;margin-top:4px;overflow-wrap:anywhere}.merge-list{border:1px solid var(--border);border-radius:8px;overflow:hidden}.merge-entry{padding:13px 15px}.merge-entry+.merge-entry{border-top:1px solid var(--border)}.merge-identity{flex:1;min-width:0;overflow-wrap:anywhere}.merge-identity strong{font-size:13px}.unavailable .merge-identity{color:var(--muted)}.merge-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}.merge-footer .hint{margin:0}.actions{flex-wrap:wrap}
 @media(max-width:600px){.merge-scopes{flex-direction:column;gap:12px}.merge-footer{align-items:flex-start;flex-direction:column}.merge-footer .button{width:100%}.merge-entry{padding:12px 10px}.merge-entry :global(.badge){max-width:7rem;white-space:normal}}
</style>
