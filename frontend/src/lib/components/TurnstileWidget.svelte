<script lang="ts">
 import {onMount} from 'svelte';import {loadTurnstile,type TurnstileAPI} from '../turnstile';
 let {siteKey,token=$bindable('')}=$props<{siteKey:string;token?:string}>();let container:HTMLDivElement,error=$state('');
 onMount(()=>{let active=true,widget:string|undefined,api:TurnstileAPI|undefined;token='';loadTurnstile().then(service=>{if(!active)return;api=service;widget=service.render(container,{sitekey:siteKey,theme:'dark',action:'login',size:'flexible',callback:(value:string)=>{if(active){token=value;error='';}},'expired-callback':()=>{token='';if(widget)service.reset(widget);},'error-callback':()=>{token='';error='人机验证暂时失败，请重试';}});}).catch(cause=>error=cause.message);return()=>{active=false;token='';if(widget&&api)api.remove(widget);};});
</script>
<div class="turnstile" bind:this={container}></div>{#if error}<p class="error" role="alert">{error}</p>{/if}
<style>.turnstile{min-height:65px;max-width:100%}</style>
