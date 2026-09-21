<script lang="ts">
 import type {Row} from '../data';
 import {api,demo,refreshState,removeRow,errorMessage} from '../store.svelte';
 import {sameEndpoint} from '../relay-address';
 import {nodeAddress} from '../node-workbench';
 import Icon from './Icon.svelte';import AppSelect from './Select.svelte';
 let {busy=$bindable(false)}=$props<{busy?:boolean}>();
 let view=$state<'list'|'add'|'delete'>('list'),error=$state(''),name=$state(''),nodeId=$state(''),entry=$state(''),selected=$state<Row|null>(null);
 const rows=$derived(demo.data.relays??[]);
 const nodes=$derived(demo.data.nodes??[]);
 const source=$derived(nodes.find(n=>n.id===nodeId));
 const choices=$derived([{value:'',label:'选择原节点'},...nodes.filter(n=>!rows.some(r=>r.nodeId===n.id)&&nodeAddress(n)!=='—').map(n=>({value:n.id,label:`${n.name} · ${nodeAddress(n)}`}))]);
 function choose(id:string){nodeId=id;if(!name)name=nodes.find(n=>n.id===id)?.name??'';}
 function current(row:Row){const node=nodes.find(n=>n.id===row.nodeId);return node?nodeAddress(node):'';}
 async function save(){
  if(busy)return;busy=true;error='';
  try{
   if(!name.trim()||!source||!entry.trim())throw new Error('请填写名称、原节点和中转地址');
   // Always create, so an outdated UI cannot overwrite an existing mapping.
   await api('/api/collections/relays',{method:'POST',body:JSON.stringify({row:{id:nodeId,nodeId,name:name.trim(),relayAddress:entry.trim()}})});
   await refreshState(true);view='list';
  }catch(e){error=errorMessage(e);}finally{busy=false;}
 }
 async function remove(){if(busy||!selected)return;busy=true;error='';try{await removeRow('relays',selected.id);selected=null;view='list';}catch(e){error=errorMessage(e);}finally{busy=false;}}
</script>

<p class="relay-help">这里的中转指外部已配置好的转发，只替换节点的连接入口。需要由 ASWired 创建转发时，请使用“隧道配置”。</p>
{#if error}<p class="error" role="alert">{error}</p>{/if}
{#if view==='add'}
 <div class="relay-toolbar"><h3>添加中转</h3><button class="button small" disabled={busy} onclick={()=>{view='list';error='';}}>返回列表</button></div>
 <div class="stack"><label class="field">中转名称<input bind:value={name} disabled={busy} placeholder="例如 台湾家宽中转"/></label><label class="field">原节点<AppSelect value={nodeId} onchange={choose} options={choices} disabled={busy} aria-label="中转原节点"/></label><label class="field">原服务器地址<input readonly value={source?nodeAddress(source):''}/></label><label class="field">中转地址<input bind:value={entry} disabled={busy} placeholder="例如 relay.example.com:38443"/></label></div>
 <p class="hint space-top">该节点的订阅、复制连接和测速将使用中转入口，UUID、SNI、公钥等保持原配置。请先在外部完成转发；保存不会连接或配置 Agent。</p>
 <div class="modal-actions"><button class="button" disabled={busy} onclick={()=>{view='list';error='';}}>取消</button><button class="button primary" disabled={busy} onclick={save}>{busy?'保存中…':'保存中转'}</button></div>
{:else if view==='delete'&&selected}
 <div class="delete-description"><h3>删除 {selected.name}？</h3><p>删除后，该节点新生成的连接恢复原服务器地址。已下载的订阅需要刷新；外部转发服务不受影响。</p></div>
 <div class="modal-actions"><button class="button" disabled={busy} onclick={()=>{view='list';error='';}}>取消</button><button class="button danger" disabled={busy} onclick={remove}>{busy?'删除中…':'删除中转'}</button></div>
{:else}
 <div class="relay-toolbar"><span class="muted">共 {rows.length} 个中转节点</span><button class="button" disabled={busy} onclick={()=>{view='add';name='';nodeId='';entry='';error='';}}><Icon name="route"/>添加中转</button></div>
 <div class="relay-list" aria-label="中转列表">{#each rows as row (row.id)}<article class="relay-row"><div><strong>{row.name}</strong><p class="relay-entry"><Icon name="route" size={15}/>中转地址：<code>{row.relayAddress}</code></p><p class="relay-origin">原服务器：<code>{row.originalAddress}</code></p>{#if !current(row)}<small class="error">原节点已删除，此映射不再生效。</small>{:else if !sameEndpoint(current(row),row.originalAddress)}<small class="error">原地址已变化，此映射未生效，请删除后重新添加。</small>{/if}</div><button class="button danger" disabled={busy} title="删除中转" aria-label={`删除中转 ${row.name}`} onclick={()=>{selected=row;view='delete';error='';}}><Icon name="trash" size={18}/></button></article>{:else}<div class="empty"><Icon name="route" size={28}/><p>暂无中转节点</p><small>添加外部中转地址，替换原节点的连接入口。</small></div>{/each}</div>
{/if}

<style>
 .relay-help{color:var(--danger);font-size:.8rem;line-height:1.6;margin:.2rem 0 1rem}.relay-toolbar{display:flex;align-items:center;justify-content:space-between;gap:.7rem;margin:1rem 0;font-size:.83rem}.relay-list{display:flex;flex-direction:column;gap:.7rem;max-height:48vh;overflow:auto}.relay-row{display:flex;align-items:center;gap:1rem;padding:1rem;border:1px solid var(--line);border-radius:.35rem;background:var(--background)}.relay-row>div{flex:1;min-width:0;overflow-wrap:anywhere}.relay-row strong{font-size:.91rem}.relay-row p{font-size:.8rem;margin-top:.5rem}.relay-entry{display:flex;align-items:center;flex-wrap:wrap;gap:.3rem;color:var(--primary)}.relay-origin{color:var(--muted)}.relay-row code{font-size:.78rem}.relay-row>.button{padding:.65rem}.delete-description{font-size:.85rem;line-height:1.7}.delete-description p{margin-top:.8rem}@media(max-width:520px){.relay-row{padding:.75rem;gap:.5rem}.relay-row strong{font-size:.85rem}}
</style>
