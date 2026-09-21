<script lang="ts">
 import Icon from './Icon.svelte';
 import {countryCode} from '../server-display';
 let {region,code,observedRegion}: {region?:unknown;code?:unknown;observedRegion?:unknown}=$props();
 const country=$derived(countryCode(region,observedRegion,code));
 const label=$derived(country ? (new Intl.DisplayNames(['zh-CN'],{type:'region'}).of(country) ?? country) : '未知国家/地区');
</script>

<span class="region-avatar" title={label} aria-label={label}>
 {#if country}<img src={`/flags/${country.toLowerCase()}.svg`} alt={label} width="26" height="20"/>{:else}<Icon name="globe" size={18}/>{/if}
</span>

<style>
 .region-avatar{flex-shrink:0}
 img{display:block;width:26px;height:20px;object-fit:contain;border-radius:2px}
</style>
