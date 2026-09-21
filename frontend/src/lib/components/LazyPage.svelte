<script lang="ts">
 import {onMount,onDestroy,type Component} from 'svelte';
 let {loader}=$props<{loader:()=>Promise<{default:Component}>}>();
 let Loaded=$state<Component|null>(null),error=$state(''),loading=$state(true),active=true;
 async function load(){loading=true;error='';try{const page=await loader();if(active)Loaded=page.default;}catch{if(active)error='页面暂时无法加载，请检查连接后重试。';}finally{if(active)loading=false;}}
 onMount(()=>{load();});onDestroy(()=>{active=false;});
</script>
{#if Loaded}<Loaded/>{:else if loading}<div class="card empty" role="status">正在打开页面…</div>{:else}<div class="card empty"><p role="alert">{error}</p><button class="button" onclick={load}>重新加载</button></div>{/if}
