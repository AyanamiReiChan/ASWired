<script lang="ts">
 import type {Row} from '../data';
 import {formatNumber} from '../format';
 import {trafficUsageView,poolResetLabel} from '../plan-traffic';
 let {row,personal=true,details=false,personalLabel='本人本期已用'}=$props<{row:Partial<Row>;personal?:boolean;details?:boolean;personalLabel?:string}>();
 const usage=$derived(trafficUsageView(row));
</script>

<div class="traffic-usage" class:shared={usage.shared}>
 {#if usage.shared}
  <span class="pool-total">共享池已用 {formatNumber(usage.used)} / {usage.unlimited?'不限':formatNumber(usage.limit)} GB</span>
 {:else}<span>{formatNumber(usage.used)} / {usage.unlimited?'不限':formatNumber(usage.limit)} GB</span>{/if}
 {#if usage.percent!==null}<div class="usage-meter" role="progressbar" aria-label={usage.shared?'共享池用量进度':'个人用量进度'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={usage.percent} aria-valuetext={`已用 ${formatNumber(usage.used)} GB，共 ${formatNumber(usage.limit)} GB`}><span style={`width:${usage.percent}%`}></span></div>{/if}
 {#if usage.shared}
  <small>共享剩余 {usage.unlimited?'不限量':usage.remaining===null?'未知':formatNumber(usage.remaining)+' GB'}{#if details&&usage.members!==null} · {usage.members} 个套餐实例{/if}</small>
  {#if personal}<small>{personalLabel} {formatNumber(usage.personalUsed)} GB</small>{/if}
  {#if details}<small>{poolResetLabel(row)}</small>{/if}
 {/if}
</div>

<style>
 .traffic-usage{display:grid;gap:5px;min-width:0;width:100%;font-size:12px;line-height:1.5;overflow-wrap:anywhere}.traffic-usage small{display:block;font-size:11px;color:var(--muted);line-height:1.5}.usage-meter{position:static;width:100%;min-width:0;height:4px;margin:0;border-radius:4px;background:var(--nested);overflow:hidden}.usage-meter>span{display:block;height:100%;border-radius:inherit;background:var(--primary)}.pool-total{color:var(--foreground)}
</style>
