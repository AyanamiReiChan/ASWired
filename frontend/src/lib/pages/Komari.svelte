<script lang="ts">
 import {onMount} from 'svelte';
 import {page} from '$app/state';
 import {openKomari,errorMessage} from '../store.svelte';
 let busy=$state(false),error=$state('');
 let controller:AbortController|undefined;
 async function enter(){
  if(busy)return;
  controller?.abort();controller=new AbortController();
  const signal=controller.signal;busy=true;error='';
  try{await openKomari(signal);}
  catch(cause){if(!signal.aborted)error=errorMessage(cause);}
  finally{if(!signal.aborted)busy=false;}
 }
 onMount(()=>{
  if(page.url.searchParams.has('komari_error'))error='Komari 登录未完成，请重试。';
  else void enter();
  return()=>controller?.abort();
 });
</script>

<div class="page-head"><div><h1>Komari 管理</h1><p>使用当前 ASWired 管理员账户进入探针后台。</p></div></div>
<section class="card padded stack">
 {#if error}<p class="error" role="alert">{error}</p>{:else}<p role="status">{busy?'正在进入 Komari…':'准备进入 Komari'}</p>{/if}
 <div class="actions"><button class="button primary" disabled={busy} onclick={enter}>{busy?'正在登录…':'进入 Komari'}</button><a class="button" href="/">返回工作区</a></div>
</section>
