<script lang="ts">
 import {onMount} from 'svelte';import {installCustomCSS} from '../custom-appearance';
 let {css}=$props<{css?:string}>();let publicCSS=$state('');
 onMount(()=>{let active=true;if(new URLSearchParams(location.search).get('nocss')!=='1')fetch('/api/public/appearance',{cache:'no-store'}).then(r=>r.ok?r.json():{customCSS:''}).then(data=>{if(active)publicCSS=typeof data.customCSS==='string'?data.customCSS:'';}).catch(()=>{});return()=>{active=false;};});
 $effect(()=>{if(typeof document!=='undefined')return installCustomCSS(css??publicCSS);});
</script>
