<script lang="ts">
 import {onMount} from 'svelte';import {goto} from '$app/navigation';import {api,demo,initialize} from '../store.svelte';
 let key=$state(''),ready=$state(false),started=$state(false),failed=$state(false);
 onMount(()=>{try{key=decodeURIComponent(location.pathname.slice('/entrance/'.length));}catch{failed=true;}history.replaceState({},'','/entrance');ready=true;});
 $effect(()=>{if(ready&&!started&&!demo.connecting&&!failed){started=true;enter();}});
 async function enter(){try{await api('/api/entry',{method:'POST',body:JSON.stringify({key})});key='';await initialize();await goto('/',{replaceState:true});}catch{key='';failed=true;}}
</script>
<div class="entry"><h1>{failed?'404':'正在打开页面'}</h1><p>{failed?'页面不存在':'请稍候…'}</p></div><style>.entry{min-height:100dvh;display:grid;align-content:center;justify-items:center;gap:1rem}</style>
