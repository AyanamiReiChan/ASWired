<script lang="ts">
 import AppSelect from './Select.svelte';import type {Row} from '../data';let {row=$bindable(),inherit=false}=$props<{row:Row;inherit?:boolean}>();
</script>
<label class="field">额度耗尽后<AppSelect value={row.quotaMode??(inherit?'':'stop')} onchange={value=>{row.quotaMode=value;if(value==='throttle'&&!row.quotaSpeedMbps)row.quotaSpeedMbps=10;}} options={[...(inherit?[{value:'',label:'继承套餐'}]:[]),{value:'stop',label:'停止套餐凭据'},{value:'throttle',label:'降低下载速度'}]} aria-label="超额处理"/></label>
{#if row.quotaMode==='throttle'}<label class="field">超额下载速度 / Mbps<input type="number" min="0.001" step="any" required bind:value={row.quotaSpeedMbps}/></label>{/if}
<label class="tag"><input type="checkbox" bind:checked={row.quotaNotify}/>额度触发或恢复时通知</label>
