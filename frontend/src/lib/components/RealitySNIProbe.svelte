<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import type { Row } from '../data';
  import { api, demo, errorMessage } from '../store.svelte';
  import { scanExpired, scanResultSelection, visibleScanResults, type RealityScan } from '../reality-scanner';
  import AppSelect from './Select.svelte';
  import Icon from './Icon.svelte';

  let { form = $bindable() } = $props<{ form: Row }>();
  const serverId = $derived(String(form.serverId || (demo.data.servers ?? []).find(row => row.name === form.server)?.id || ''));
  const serverName = $derived((demo.data.servers ?? []).find(row => row.id === serverId)?.name || form.server || serverId);
  let origin = $state('agent'), targets = $state(''), scanning = $state(false), error = $state(''), notice = $state('');
  let scan = $state<RealityScan | null>(null), now = $state(Date.now());
  let request: AbortController | undefined;
  const sourceId = $derived(origin === 'agent' ? serverId : '');
  const expired = $derived(scanExpired(scan, now));
  const results = $derived(visibleScanResults(scan?.results ?? [], false, 'latency'));

  function stop() { request?.abort(); request = undefined; scanning = false; }
  $effect(() => {
    const currentForm = form;
    serverId;
    sourceId;
    origin;
    untrack(() => { stop(); scan = null; error = ''; notice = ''; targets = String(currentForm.target || ''); });
  });
  onMount(() => { const timer = setInterval(() => now = Date.now(), 1000); return () => clearInterval(timer); });
  onDestroy(stop);

  async function probe() {
    if (scanning || (origin === 'agent' && !serverId)) return;
    const currentForm = form, currentSource = sourceId, currentOrigin = origin;
    const pending = new AbortController();
    request = pending; scanning = true; scan = null; error = ''; notice = '';
    try {
      const response = await api<RealityScan>('/api/reality-targets/scan', {
        method: 'POST', body: JSON.stringify({ targets, serverId: currentSource }), signal: pending.signal
      });
      if (request !== pending || pending.signal.aborted || form !== currentForm || sourceId !== currentSource || origin !== currentOrigin) return;
      if (response.source !== currentOrigin || (response.serverId || '') !== currentSource) throw new Error('探测来源不匹配，请重新探测。');
      scan = response; now = Date.now();
    } catch (cause) { if (request === pending && !pending.signal.aborted) error = errorMessage(cause); }
    finally { if (request === pending) { request = undefined; scanning = false; } }
  }

  function apply(id: string) {
    const selection = scanResultSelection(scan, id, sourceId);
    if (!selection) { now = Date.now(); return; }
    form.target = selection.target; form.sni = selection.sni;
    notice = `已填入 ${selection.target}，SNI：${selection.sni}`;
  }
  const latency = (value: number) => Number.isFinite(value) && value > 0 ? `${value.toFixed(1)} ms` : '-';
</script>

<section class="sni-probe" aria-label="SNI 探测">
  <div class="probe-heading"><h4><Icon name="search" size={16}/>SNI 探测</h4><span>{origin === 'agent' ? `Agent · ${serverName || '未选择服务器'}` : '主控'}</span></div>
  <div class="probe-inputs">
    <label class="field">探测来源<AppSelect bind:value={origin} options={[{value:'agent',label:'当前服务器 Agent'},{value:'controller',label:'主控'}]} aria-label="SNI 探测来源"/></label>
    <label class="field targets">探测目标<textarea aria-label="SNI 探测目标" bind:value={targets} rows="2" maxlength="8192" disabled={scanning} placeholder="域名、IP:端口或公网网段；多个用逗号或换行分隔，留空使用内置候选"></textarea></label>
  </div>
  <div class="probe-actions"><button type="button" class="button small" disabled={scanning || (origin === 'agent' && !serverId)} onclick={probe}><Icon name="search" size={14}/>{scanning ? '正在探测…' : '开始探测'}</button>{#if scanning}<button type="button" class="button small" onclick={() => { stop(); notice = '已停止等待探测结果。'; }}>取消探测</button>{/if}{#if origin === 'agent' && !serverId}<span class="muted">请先选择服务器</span>{/if}</div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if notice}<p class="notice" role="status">{notice}</p>{/if}
  {#if scan}
    <div class="probe-summary"><span>{scan.feasibleCount} 个合格 / 共 {scan.total} 个</span><span>{expired ? '结果已过期，请重新探测' : `来源：${scan.source === 'agent' ? scan.serverName || serverName : '主控'}`}</span></div>
    <div class="probe-results">
      {#each results as result (result.id)}
        <article class="probe-result" aria-label={`探测结果 ${result.target}`}>
          <div class="result-heading"><div><strong>{result.target}</strong><span>SNI · {result.host || '未发现可用域名'}</span></div><span class:passed={result.feasible}>{result.feasible ? '合格' : '不合格'} · {latency(result.latencyMs)}</span></div>
          <div class="result-actions"><div class="checks">{#each [{label:'TLS 1.3',passed:result.tls13},{label:'h2',passed:result.h2},{label:'X25519',passed:result.x25519},{label:'证书',passed:result.certValid && result.certChainValid}] as check}<span class:passed={check.passed}><Icon name={check.passed ? 'check' : 'x'} size={12}/>{check.label}</span>{/each}</div><button type="button" class="button small" disabled={!scanResultSelection(scan, result.id, sourceId, now)} onclick={() => apply(result.id)}>采用此结果</button></div>
          {#if result.reason}<p class="reason">{result.reason}</p>{/if}
        </article>
      {:else}<p class="muted">没有探测结果</p>{/each}
    </div>
  {/if}
</section>

<style>
  .sni-probe { min-width: 0; padding-bottom: 1rem; border-bottom: 1px solid var(--line); font-size: .78rem; }
  .probe-heading, .probe-actions, .probe-summary, .result-heading, .result-actions, .checks, h4 { display: flex; align-items: center; gap: .6rem; }
  .probe-heading, .probe-summary, .result-heading, .result-actions { justify-content: space-between; }
  h4 { margin: 0; font-size: .88rem; }
  .probe-heading > span, .probe-summary, .result-heading span, .reason { color: var(--muted); }
  .probe-heading, .probe-actions, .probe-summary, .result-heading, .result-actions { flex-wrap: wrap; }
  .probe-inputs { display: grid; grid-template-columns: minmax(140px, 1fr) minmax(0, 3fr); gap: .8rem; margin: .8rem 0; }
  .field { min-width: 0; }
  textarea { width: 100%; min-height: 4.5rem; resize: vertical; font-size: .78rem; }
  p { margin: .6rem 0 0; line-height: 1.6; overflow-wrap: anywhere; }
  .notice { color: var(--success); }
  .probe-summary { margin: 1rem 0 .4rem; font-size: .72rem; }
  .probe-results { max-height: 20rem; overflow: auto; }
  .probe-result { padding: .8rem 0; border-top: 1px solid var(--line); }
  .result-heading > div { min-width: 0; }
  .result-heading strong, .result-heading span { overflow-wrap: anywhere; }
  .result-heading > div > span { display: block; margin-top: .25rem; }
  .result-heading > span { font-size: .72rem; font-variant-numeric: tabular-nums; }
  .result-actions { margin-top: .6rem; }
  .checks { flex-wrap: wrap; gap: .4rem .8rem; color: var(--muted); font-size: .7rem; }
  .checks span { display: inline-flex; align-items: center; gap: .2rem; }
  .checks .passed, .result-heading .passed { color: var(--success); }
  .reason { font-size: .72rem; }
  @media (max-width: 600px) { .probe-inputs { grid-template-columns: minmax(0, 1fr); } }
</style>
