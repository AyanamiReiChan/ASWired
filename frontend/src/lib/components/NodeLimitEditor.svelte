<script lang="ts">
 import {demo} from '../store.svelte';import type {Row} from '../data';
 let {row=$bindable()}=$props<{row:Row}>();let selected=$state('');
 const resources=$derived([...demo.data.servers.map(item=>({id:item.id,name:'服务器 · '+item.name})),...demo.data.nodes.filter(item=>item.managedInbound).map(item=>({id:item.id,name:'节点 · '+item.name}))]);
 const entries=$derived(Object.entries(row.nodeLimits??{}) as [string,Record<string,unknown>][]);
 const available=$derived(resources.filter(item=>!Object.hasOwn(row.nodeLimits??{},item.id)));
 function patch(id:string,key:string,input:HTMLInputElement){const entry={...row.nodeLimits?.[id]};if(input.value==='')delete entry[key];else entry[key]=input.valueAsNumber;row.nodeLimits={...row.nodeLimits,[id]:entry};}
 function remove(id:string){const copy={...row.nodeLimits};delete copy[id];row.nodeLimits=copy;}
</script>
<section class="full space-top"><h3>逐节点限额覆盖</h3><p class="hint">留空继承，0 表示不限。同一作用域节点优先于服务器；成员覆盖优先于套餐。IP 数量表示同时在线 IP，连接数单独计算。</p>
 <div class="actions"><label class="field grow">选择服务器或节点<select bind:value={selected}><option value="">选择资源</option>{#each available as item}<option value={item.id}>{item.name}</option>{/each}</select></label><button type="button" class="button" disabled={!selected} onclick={()=>{row.nodeLimits={...row.nodeLimits,[selected]:{}};selected='';}}>添加覆盖</button></div>
 {#if entries.length}<div class="table-scroll space-top"><table><thead><tr><th>资源</th><th>下载 Mbps</th><th>连接上限</th><th>同时在线 IP</th><th></th></tr></thead><tbody>{#each entries as [id,limits]}<tr><td>{resources.find(item=>item.id===id)?.name??'已移除资源 · '+id}</td>{#each [['speed','下载 Mbps'],['connectionLimit','连接上限'],['ipLimit','同时在线 IP']] as [key,label]}<td><input type="number" min="0" step={key==='speed'?'any':'1'} aria-label={`${resources.find(item=>item.id===id)?.name??id} ${label}`} placeholder="继承" value={limits[key]??''} onchange={e=>patch(id,key,e.currentTarget)}/></td>{/each}<td><button type="button" class="button small" onclick={()=>remove(id)}>移除覆盖</button></td></tr>{/each}</tbody></table></div>{/if}
</section>
<style>input{width:8rem}.grow{flex:1}</style>
