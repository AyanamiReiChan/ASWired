<script lang="ts">
 import AppSelect from './Select.svelte';import type {Row} from '../data';let {row=$bindable(),inherit=false,shared=false}=$props<{row:Row;inherit?:boolean;shared?:boolean}>();
</script>
<label class="field">{shared?'共享池额度耗尽后':'额度耗尽后'}<AppSelect value={row.quotaMode??(inherit?'':'stop')} onchange={value=>{row.quotaMode=value;if(value==='throttle'&&!row.quotaSpeedMbps)row.quotaSpeedMbps=10;}} options={[...(inherit?[{value:'',label:'继承套餐'}]:[]),{value:'stop',label:shared?'停止池内套餐凭据':'停止套餐凭据'},{value:'throttle',label:shared?'降低池内成员下载速度':'降低下载速度'}]} aria-label="超额处理"/></label>
{#if row.quotaMode==='throttle'}<label class="field">超额下载速度 / Mbps<input type="number" min="0.001" step="any" required bind:value={row.quotaSpeedMbps}/></label>{/if}
<label class="tag"><input type="checkbox" bind:checked={row.quotaNotify}/>额度触发或恢复时通知</label>
