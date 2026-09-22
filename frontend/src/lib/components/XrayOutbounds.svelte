<script lang="ts">
 import AppSelect from "./Select.svelte";
 import {onDestroy} from 'svelte';
 import {demo,getRow,api,errorMessage} from '../store.svelte';
 import {outboundTypes,outboundTemplate,outboundFromNode,objectJSON,replaceOutbound,deleteOutbound,moveItem,type XrayObject} from '../xray-workbench';
 import Icon from './Icon.svelte';
 import './xray-workbench.css';
 let {config,disabled=false,editing=$bindable(false),onchange}:{config:XrayObject;disabled?:boolean;editing?:boolean;onchange:(config:XrayObject)=>void}=$props();
 let selected=$state(0),hideDefault=$state(false),menu=$state(false),draft=$state(''),error=$state(''),confirm=$state(false),kind=$state(''),nodeId=$state(''),nodeURI=$state(''),subscriptions=$state<any[]>([]),subscriptionId=$state(''),loading=$state(false),tag=$state(''),active=true,request=0;
 const outs=$derived(config.outbounds??[]),current=$derived(outs[selected]);
 onDestroy(()=>{active=false;request++;});
 const locked=$derived(disabled||loading);
 function select(index:number){if(editing)return;selected=index;confirm=false;error='';}
 function create(type:string){if(locked||editing)return;menu=false;kind=type;selected=-1;tag=`${type==='warp'?'warp':type}-${crypto.randomUUID().slice(0,6)}`;draft=JSON.stringify(outboundTemplate(type==='node'?'vless':type,tag),null,2);nodeId='';nodeURI='';subscriptionId='';subscriptions=[];editing=true;error='';}
 function edit(){kind='json';draft=JSON.stringify(current,null,2);editing=true;confirm=false;error='';}
 function cancel(){request++;loading=false;editing=false;kind='';nodeURI='';draft='';selected=Math.max(0,selected);error='';}
 function accept(){try{const next=objectJSON(draft);const index=selected<0?outs.length:selected;onchange(replaceOutbound(config,selected,next));selected=index;editing=false;draft='';nodeURI='';error='';}catch(cause){error=errorMessage(cause);}}
 function remove(){try{onchange(deleteOutbound(config,selected));selected=0;confirm=false;error='';}catch(cause){error=errorMessage(cause);}}
 function reorder(from:number,to:number){if(locked||editing)return;onchange({...config,outbounds:moveItem(outs,from,to)});selected=to;}
 let drag=-1;
 async function chooseNode(){if(!nodeId)return;const generation=++request;loading=true;error='';subscriptions=[];subscriptionId='';try{const node=await getRow('nodes',nodeId);if(!active||generation!==request)return;if(node.managedInbound){const result=await api('/api/temporary-subscriptions');if(!active||generation!==request)return;subscriptions=(result.subscriptions??[]).filter((s:any)=>s.nodes?.some((n:any)=>n.id===nodeId));subscriptionId=subscriptions[0]?.id??'';if(!subscriptions.length)throw new Error('此节点没有当前账户可用的套餐凭据，可粘贴已授权的节点链接');}else{draft=JSON.stringify(outboundFromNode(node,tag),null,2);kind='node-ready';}}catch(cause){if(active&&generation===request)error=errorMessage(cause);}finally{if(active&&generation===request)loading=false;}}
 async function useSubscription(){const generation=++request;loading=true;error='';try{const result=await api(`/api/nodes/${encodeURIComponent(nodeId)}/connection?subscriptionId=${encodeURIComponent(subscriptionId)}`);if(active&&generation===request){draft=JSON.stringify(outboundFromNode({uri:result.uri},tag),null,2);kind='node-ready';}}catch(cause){if(active&&generation===request)error=errorMessage(cause);}finally{if(active&&generation===request)loading=false;}}
 function useURI(){try{draft=JSON.stringify(outboundFromNode({uri:nodeURI},tag),null,2);kind='node-ready';error='';}catch(cause){error=errorMessage(cause);}}
</script>

<section class="workbench" aria-label="服务器出站管理">
 <div class="wb-heading"><h3>出站配置 <small>（共 {outs.length} 个）· 第一项为默认出口</small></h3><div class="wb-actions"><button class="button small" disabled={locked||editing} onclick={()=>hideDefault=!hideDefault}>{hideDefault?'显示默认':'隐藏默认'}</button><details class="wb-menu" bind:open={menu}><summary class="button primary"><Icon name="plus" size={14}/>添加出站⌄</summary><div class="wb-menu-items">{#each outboundTypes as [type,label]}<button disabled={locked||editing} onclick={()=>create(type)}>{label}</button>{/each}</div></details></div></div>
 {#if error}<p class="wb-error" role="alert">{error}</p>{/if}
 <div class="wb-split"><div class="wb-list">{#each outs as out,index}{#if !hideDefault||index!==0}<div class="wb-row" class:selected={selected===index} draggable={!locked&&!editing} ondragstart={()=>drag=index} ondragover={event=>event.preventDefault()} ondrop={event=>{event.preventDefault();if(drag>=0)reorder(drag,index);drag=-1;}} ondragend={()=>drag=-1} role="group" aria-label={`出站 ${out.tag}`}><button class="wb-select" disabled={editing} onclick={()=>select(index)}><span aria-hidden="true">⠿</span><span class="wb-copy">{out.tag}</span>{#if index===0}<span class="wb-badge">默认</span>{/if}<span class="wb-badge">{out.protocol}</span></button><div class="wb-order"><button aria-label={`上移出站 ${out.tag}`} disabled={locked||editing||index===0} onclick={()=>reorder(index,index-1)}>↑</button><button aria-label={`下移出站 ${out.tag}`} disabled={locked||editing||index===outs.length-1} onclick={()=>reorder(index,index+1)}>↓</button></div></div>{/if}{:else}<div class="wb-empty">暂无出站，请添加。</div>{/each}</div>
 <div class="wb-detail">{#if editing}<h4>{selected<0?'添加出站':'编辑出站'}</h4><fieldset disabled={locked}>
 {#if kind==='node'}<label class="field">出站标签<input bind:value={tag}/></label><label class="field">从节点库选择<AppSelect aria-label="从节点库选择" bind:value={nodeId} onchange={chooseNode} options={[{value:'',label:'选择节点'},...(demo.data.nodes??[]).map(row=>({value:row.id,label:row.name}))]}/></label>{#if subscriptions.length}<label class="field">使用套餐凭据<AppSelect aria-label="使用套餐凭据" bind:value={subscriptionId} options={subscriptions.map(sub=>({value:sub.id,label:sub.name??sub.id}))}/></label><button class="button small" onclick={useSubscription}>载入连接配置</button>{/if}<label class="field">或粘贴 VLESS TCP REALITY 链接<textarea aria-label="出站节点链接" bind:value={nodeURI} placeholder="vless://…"></textarea></label><button class="button small" onclick={useURI}>转换为出站</button>
 {:else}
 {#if kind==='warp'||kind==='wireguard'}<p class="wb-hint">填写已有的 {kind==='warp'?'WARP':'WireGuard'} 私钥、隧道地址和对端信息。WARP 使用 WireGuard 出站；此处不自动注册 Cloudflare 账户。</p>{/if}
 {#if kind==='loopback'}<p class="wb-hint">settings.inboundTag 填写回环使用的入站标签，并为该标签配置路由，避免循环。</p>{/if}
 <label class="field">出站 JSON<textarea class="code-editor" aria-label="出站 JSON" bind:value={draft} spellcheck="false"></textarea></label><p class="wb-hint">保留完整 Xray 字段；“采用修改”只更新本窗口草稿。</p><button class="button primary" onclick={accept}>采用修改</button>{/if}
 </fieldset><div class="wb-actions" style="margin-top:14px"><button class="button" disabled={loading} onclick={cancel}>取消编辑</button></div>
 {:else if current}<div class="wb-heading"><h4>{current.tag} <span class="wb-badge">{current.protocol}</span></h4><div class="wb-actions"><button class="button small" disabled={locked} onclick={edit}>编辑</button><button class="button small" disabled={locked||selected===0} onclick={()=>reorder(selected,0)}>设为默认</button><button class="button small danger" disabled={locked} onclick={()=>confirm=true}>删除</button></div></div><p class="wb-hint">类型 · {current.protocol}</p><pre aria-label="出站配置预览">{JSON.stringify(current,null,2)}</pre>{#if confirm}<div class="wb-confirm"><p class="wb-hint">从草稿删除“{current.tag}”？保存完整配置后才会生效。{selected===0?'下一项将成为默认出口。':''}</p><div class="wb-actions"><button class="button small" onclick={()=>confirm=false}>取消</button><button class="button small danger" disabled={locked} onclick={remove}>确认删除出站</button></div></div>{/if}
 {:else}<div class="wb-empty">选择一个出站查看配置，或添加新出站。</div>{/if}</div></div>
 <p class="wb-hint">拖动或使用上下按钮排序。未命中路由规则的连接使用第一项出站；所有更改在保存完整配置后生效。</p>
</section>
