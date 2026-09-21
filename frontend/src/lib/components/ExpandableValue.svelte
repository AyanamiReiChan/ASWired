<script lang="ts">
 import Icon from './Icon.svelte';
 import {formatDisplayValue} from '../format';

 let {value,label='详细内容',force=false}=$props<{value:unknown;label?:string;force?:boolean}>();
 let open=$state(false);

 function describe(input:unknown){
  let parsed=input;
  if(typeof input==='string'&&/^[\s]*[\[{]/.test(input)){
   try{parsed=JSON.parse(input);}catch{parsed=input;}
  }
  const structured=parsed!==null&&typeof parsed==='object';
  return {
   text:structured?JSON.stringify(parsed,null,2):formatDisplayValue(input),
   structured,
   summary:structured?`JSON · ${Object.keys(parsed as object).length} 项`:'文本'
  };
 }

 const content=$derived(describe(value));
 const expandable=$derived(force||content.structured||content.text.length>160||content.text.split('\n').length>3);
</script>

{#if expandable}
 <details class="expandable-value" bind:open>
  <summary>
   <span class="detail-label"><span class="chevron"><Icon name="right" size={14}/></span>{label}</span>
   <span class="detail-meta">{content.summary}</span>
   <span class="detail-toggle">{open?'收起':'展开'}</span>
  </summary>
  {#if open}<pre role="region" aria-label={label}>{content.text}</pre>{/if}
 </details>
{:else}
 <span class="detail-value">{content.text}</span>
{/if}

<style>
 .detail-value{display:block;font-size:.83rem;font-weight:600;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;}
 .expandable-value{min-width:0;max-width:100%;border:1px solid var(--line);border-radius:.5rem;background:var(--sidebar);overflow:hidden;font-weight:400;}
 summary{display:flex;align-items:center;gap:.65rem;padding:.65rem .75rem;cursor:pointer;list-style:none;font-size:.78rem;line-height:1.5;}
 summary::-webkit-details-marker{display:none;}
 summary:hover{background:var(--card);}
 summary:focus-visible{outline:2px solid var(--primary);outline-offset:-2px;}
 .detail-label{display:flex;align-items:center;gap:.4rem;min-width:0;overflow-wrap:anywhere;}
 .chevron{display:flex;flex-shrink:0;}
 details[open] .chevron{transform:rotate(90deg);}
 .detail-meta{margin-left:auto;color:var(--muted);font-size:.7rem;white-space:nowrap;}
 .detail-toggle{flex-shrink:0;color:var(--muted);font-size:.7rem;}
 pre{margin:0;max-height:20rem;max-width:100%;overflow:auto;padding:.85rem;border-top:1px solid var(--line);color:var(--foreground);white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2;font:.75rem/1.7 ui-monospace,Consolas,monospace;}
 pre:focus-visible{outline:2px solid var(--primary);outline-offset:-2px;}
</style>
