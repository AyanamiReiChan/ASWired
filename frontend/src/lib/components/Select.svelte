<script lang="ts">
  import { Select } from 'bits-ui';
  import { ChevronsUpDown, Check } from '@lucide/svelte';

  type Option = string | { value: string; label: string; disabled?: boolean };
  type Props = {
    value: string;
    options: Option[];
    'aria-label': string;
    placeholder?: string;
    onchange?: (value: string) => void;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    class?: string;
  };
  let {
    value = $bindable(),
    options,
    'aria-label': ariaLabel,
    placeholder = '请选择',
    onchange,
    disabled = false,
    required = false,
    name,
    class: className = '',
  }: Props = $props();

  const items = $derived.by(() => {
    const seen = new Set<string>();
    return options
      .map(option => typeof option === 'string' ? { value: option, label: option } : option)
      .filter(option => {
        if (seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
      });
  });
  const selectedLabel = $derived(items.find(item => item.value === value)?.label ?? value ?? '');

  function change(next: string) {
    value = next;
    onchange?.(next);
  }
</script>

<Select.Root type="single" bind:value {items} {disabled} {required} {name} onValueChange={change}>
  <Select.Trigger type="button" class={`app-select-trigger ${className}`} aria-label={ariaLabel}>
    <span class="app-select-value" class:app-select-placeholder={!selectedLabel}>{selectedLabel || placeholder}</span>
    <ChevronsUpDown size={15} strokeWidth={1.65} class="app-select-chevron" aria-hidden="true"/>
  </Select.Trigger>
  <Select.Portal>
    <Select.Content class="app-select-content" sideOffset={4} align="start" collisionPadding={8}>
      <Select.Viewport class="app-select-viewport">
        {#each items as item (item.value)}
          <Select.Item value={item.value} label={item.label} disabled={item.disabled} class="app-select-item">
            {#snippet children({ selected })}
              <span class="app-select-label">{item.label}</span>
              {#if selected}<Check size={15} strokeWidth={1.65} class="app-select-check" aria-hidden="true"/>{/if}
            {/snippet}
          </Select.Item>
        {:else}
          <div class="app-select-empty">暂无选项</div>
        {/each}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>

<style>

  :global(.app-select-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: .375rem;
    width: fit-content;
    min-width: 8rem;
    max-width: 100%;
    height: 2rem;
    padding: .25rem .625rem;
    border: 1px solid transparent;
    border-radius: .5rem;
    background: rgb(255 255 255 / 8%);
    color: var(--foreground);
    font-size: .875rem;
    line-height: 1.25rem;
    text-align: left;
    white-space: nowrap;
    outline: none;
    transition: background-color .1s, border-color .1s, box-shadow .1s;
  }
  :global(.field .app-select-trigger) { width: 100%; }
  :global(.app-select-trigger:hover) { background: rgb(255 255 255 / 11.2%); }
  :global(.app-select-trigger:focus-visible) {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 50%, transparent);
    outline: none;
  }
  :global(.app-select-trigger:disabled) { cursor: not-allowed; opacity: .5; }
  .app-select-value { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .app-select-placeholder { color: var(--muted); }
  :global(.app-select-chevron) { flex-shrink: 0; opacity: .5; pointer-events: none; }
  :global(.app-select-content) {
    position: relative;
    isolation: isolate;
    z-index: 130;
    min-width: var(--bits-select-anchor-width, 8rem);
    max-width: calc(100vw - 1rem);
    max-height: min(20rem, var(--bits-select-content-available-height, 20rem));
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-radius: .7rem;
    background: oklch(.28 .004 106.6);
    color: var(--foreground);
    box-shadow: 0 0 0 1px rgb(250 249 245 / 5%), 0 25px 50px -12px rgb(0 0 0 / 25%);
    outline: none;
    scrollbar-width: thin;
    scrollbar-color: var(--nested) transparent;
    transform-origin: var(--bits-select-content-transform-origin);
  }
  :global(.app-select-content[data-state='open']) { animation: select-appear .1s ease-out; }
  :global(.app-select-viewport) { padding: .25rem; }
  :global(.app-select-item) {
    position: relative;
    display: flex;
    align-items: center;
    gap: .625rem;
    width: 100%;
    padding: .5rem 2rem .5rem .75rem;
    border-radius: .7rem;
    font-size: .875rem;
    line-height: 1.25rem;
    cursor: default;
    user-select: none;
    outline: none;
  }
  :global(.app-select-item[data-highlighted]) { background: oklch(.3 .004 106.6); }
  :global(.app-select-item[data-disabled]) { opacity: .5; pointer-events: none; }
  .app-select-label { min-width: 0; overflow-wrap: anywhere; }
  :global(.app-select-check) { position: absolute; right: .5rem; pointer-events: none; }
  .app-select-empty { padding: .75rem; font-size: .875rem; color: var(--muted); }
  @keyframes select-appear { from { opacity: 0; transform: scale(.95); } to { opacity: 1; transform: scale(1); } }
  @media (prefers-reduced-motion: reduce) { :global(.app-select-content[data-state='open']) { animation: none; } }
</style>
