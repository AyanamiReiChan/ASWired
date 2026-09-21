<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Row } from '../data';
  import { copy } from '../store.svelte';
  import { deriveRealityPublicKey, generateRealityKeyPair, generateRealityShortId } from '../reality-keys';
  import RealitySNIProbe from './RealitySNIProbe.svelte';
  import Icon from './Icon.svelte';
  import AppSelect from './Select.svelte';

  let { form = $bindable(), busy = $bindable(false) } = $props<{ form: Row; busy?: boolean }>();
  let reveal = $state(false), message = $state(''), failed = $state(false), replace = $state(false);
  let active = true;
  onDestroy(() => { active = false; busy = false; });

  async function keys(generate: boolean) {
    if (busy) return;
    const original = form;
    busy = true; message = ''; failed = false;
    try {
      const pair = generate ? await generateRealityKeyPair() : {
        privateKey: String(form.privateKey).trim(),
        publicKey: await deriveRealityPublicKey(String(form.privateKey).trim())
      };
      if (!active || form !== original) return;
      form.privateKey = pair.privateKey; form.publicKey = pair.publicKey;
      if (generate) reveal = false;
      replace = false;
      message = generate ? '密钥对已生成，保存后保留。' : '已根据私钥更新公钥。';
    } catch (error) {
      if (active) { failed = true; message = error instanceof Error ? error.message : '密钥处理失败，请重试'; }
    } finally { if (active) busy = false; }
  }

  function addShortId() {
    try {
      const id = generateRealityShortId();
      form.shortIds = [String(form.shortIds ?? '').trim(), id].filter(Boolean).join(', ');
    } catch (error) {
      failed = true;
      message = error instanceof Error ? error.message : 'Short ID 生成失败，请重试';
    }
  }
</script>

<section class="reality-fields" aria-label="Reality 配置">
  <div class="section-head">
    <div><h3><Icon name="key"/> Reality 配置</h3><p class="hint">配置服务端密钥与握手参数，公钥供客户端连接使用。</p></div>
  </div>
  {#if !form.privateKey}<p class="missing-key">此记录尚未保存 Reality 密钥，请填写已有私钥或生成密钥对。</p>{/if}
  <div class="form-grid">
    <div class="full"><RealitySNIProbe bind:form/></div>
    <label class="field">目标地址 / Target *<input bind:value={form.target} placeholder="example.com:443" required/><small class="hint">支持域名端口、IP 端口或本机站点地址。</small></label>
    <label class="field">允许的 SNI 域名 *<input bind:value={form.sni} placeholder="example.com, www.example.com" required/><small class="hint">多个域名用逗号分隔，不支持通配符。</small></label>
    <div class="field full">
      <label for="reality-private-key">私钥 / Private Key *</label>
      <div class="key-input"><input id="reality-private-key" class="mono" type={reveal ? 'text' : 'password'} bind:value={form.privateKey} oninput={() => { form.publicKey = ''; message = ''; }} autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="填写已有 X25519 私钥" required disabled={busy}/><button type="button" class="icon-button" aria-label={reveal ? '隐藏 Reality 私钥' : '显示 Reality 私钥'} aria-pressed={reveal} onclick={() => reveal = !reveal}><Icon name={reveal ? 'lock' : 'eye'}/></button></div>
    </div>
    <div class="field full">
      <label for="reality-public-key">客户端公钥 / Public Key</label>
      <div class="key-input"><input id="reality-public-key" class="mono" value={form.publicKey} readonly placeholder="由私钥计算"/><button type="button" class="icon-button" disabled={!form.publicKey} aria-label="复制 Reality 公钥" onclick={() => copy(form.publicKey)}><Icon name="copy"/></button></div>
      <small class="hint">旧版字段名为 publicKey，新版 Xray 客户端字段名为 password。</small>
    </div>
    <div class="full actions key-actions">
      <button type="button" class="button small" disabled={busy} onclick={() => { if (form.privateKey) replace = true; else void keys(true); }}><Icon name="refresh"/>{busy ? '处理中…' : '生成密钥对'}</button>
      <button type="button" class="button small" disabled={busy || !form.privateKey} onclick={() => keys(false)}>根据私钥计算公钥</button>
    </div>
    {#if replace}<div class="full replace-key"><p>替换密钥后，使用原公钥的客户端需要更新配置。取消编辑可保留原配置。</p><div class="actions"><button type="button" class="button small" onclick={() => replace = false}>保留原密钥</button><button type="button" class="button small" disabled={busy} onclick={() => keys(true)}>确认生成新密钥对</button></div></div>{/if}
    {#if message}<p class="full hint" class:error={failed} role="status">{message}</p>{/if}
    <div class="field full">
      <label for="reality-short-ids">Short ID 列表</label>
      <div class="short-id-input"><input id="reality-short-ids" class="mono" bind:value={form.shortIds} placeholder="多个 Short ID 用逗号分隔" autocapitalize="none" spellcheck="false"/><button type="button" class="button small" onclick={addShortId}>生成 Short ID</button></div>
      <small class="hint">每项为偶数位十六进制，最多 16 位。</small>
      <label class="checkbox-label"><input type="checkbox" bind:checked={form.allowEmptyShortId}/>允许空 Short ID</label>
    </div>
  </div>
  <details class="reality-advanced">
    <summary>高级参数</summary>
    <div class="form-grid">
      <label class="field">PROXY protocol<AppSelect bind:value={form.xver} options={[{value:'0',label:'0 · 关闭'},{value:'1',label:'1 · 版本 1'},{value:'2',label:'2 · 版本 2'}]} aria-label="Reality PROXY protocol"/></label>
      <label class="field">最大时间差 / 毫秒<input type="number" min="0" step="1" bind:value={form.maxTimeDiff}/><small class="hint">0 表示不限制。</small></label>
      <label class="field">最低客户端版本<input bind:value={form.minClientVer} placeholder="不限制，例如 1.8.0"/></label>
      <label class="field">最高客户端版本<input bind:value={form.maxClientVer} placeholder="不限制，例如 1.8.0"/></label>
      <label class="checkbox-label full"><input type="checkbox" bind:checked={form.realityShow}/>开启 Reality 调试日志</label>
    </div>
  </details>
</section>

<style>
  .reality-fields { margin-top: 1.4rem; padding-top: 1.2rem; border-top: 1px solid var(--line); }
  h3 { display: flex; align-items: center; gap: .5rem; }
  h3 :global(svg) { color: var(--primary); }
  .section-head { margin-bottom: 1rem; }
  .section-head .hint { margin-top: .35rem; }
  .hint { display: block; padding: 0; margin-bottom: 0; background: none; border: 0; border-radius: 0; font-size: .75rem; line-height: 1.6; }
  .full { grid-column: 1 / -1; }
  .missing-key { padding: .7rem .85rem; margin-bottom: 1rem; border-radius: .5rem; background: var(--nested); color: var(--muted); font-size: .8rem; }
  .key-input, .short-id-input { display: flex; align-items: center; gap: .5rem; min-width: 0; }
  .key-input input, .short-id-input input { flex: 1; width: 0; }
  .key-input input { font-size: .8rem; }
  .key-actions { flex-wrap: wrap; }
  .checkbox-label { display: flex; align-items: center; gap: .5rem; font-size: .8rem; }
  .checkbox-label input { width: 14px; flex: 0 0 14px; }
  .replace-key { background: var(--nested); padding: .8rem; border-radius: .5rem; font-size: .8rem; }
  .replace-key .actions { margin-top: .6rem; flex-wrap: wrap; }
  .reality-advanced { margin-top: 1.1rem; border-top: 1px solid var(--line); padding-top: .8rem; }
  summary { cursor: pointer; color: var(--muted); font-size: .85rem; padding: .25rem 0; }
  .reality-advanced .form-grid { padding-top: 1rem; }
  @media (max-width: 500px) { .short-id-input { flex-wrap: wrap; } .short-id-input input { flex-basis: 100%; width: 100%; } }
</style>
