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
 {#if usage.percent!==null}<div class="progress thin" aria-label={usage.shared?'共享池用量进度':'个人用量进度'}><i style={`width:${usage.percent}%`}></i></div>{/if}
 {#if usage.shared}
  <small>共享剩余 {usage.unlimited?'不限量':usage.remaining===null?'未知':formatNumber(usage.remaining)+' GB'}{#if details&&usage.members!==null} · {usage.members} 个套餐实例{/if}</small>
  {#if personal}<small>{personalLabel} {formatNumber(usage.personalUsed)} GB</small>{/if}
  {#if details}<small>{poolResetLabel(row)}</small>{/if}
 {/if}
</div>

<style>
 .traffic-usage{display:grid;gap:5px;min-width:140px;font-size:12px;line-height:1.5}.traffic-usage small{display:block;font-size:11px;color:var(--muted);line-height:1.5}.traffic-usage .progress{margin:0}.pool-total{color:var(--foreground)}
</style>
