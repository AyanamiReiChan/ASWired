<script lang="ts">
 import AppSelect from "./Select.svelte";
 import {agentUpdateBlockReason} from '../agent-updates';
 import Modal from './Modal.svelte';import {demo,runAction,errorMessage,refreshState} from '../store.svelte';
 let open=$state(false),selected=$state<string[]>([]),version=$state(''),url=$state(''),checksum=$state(''),busy=$state(false),error=$state(''),tasks=$state<{server:string;id:string}[]>([]);
 let arch=$state('amd64');
 let submitted=$state<string[]>([]);
 const eligible=$derived(demo.data.servers.filter(server=>!agentUpdateBlockReason(server)&&!submitted.includes(server.id)));
 const selectedIDs=$derived(selected.filter(id=>eligible.some(server=>server.id===id)));
 const needsMigration=$derived(demo.data.servers.filter(server=>server.status==='在线'&&!server.capabilities?.agent_update).length);
 $effect(()=>{if(selectedIDs.length!==selected.length)selected=[...selectedIDs];});
 async function loadRelease(){if(busy)return;busy=true;error='';try{const result=await runAction('system.update',undefined,undefined,{channel:'stable'});const asset=result.agents?.[arch];if(!asset)throw new Error('该发行版没有对应架构的 Agent');version=result.version.replace(/^v/,'');url=asset.url;checksum=asset.sha256;}catch(cause){error=errorMessage(cause);}finally{busy=false;}}
 const labels:Record<string,string>={staged:'制品已校验',ready:'等待重启',restarting:'新版本验证中',healthy:'已重新认证',completed:'升级成功',rolled_back:'已自动回退',failed:'升级失败'};
 async function refresh(){if(busy)return;busy=true;error='';try{await refreshState();submitted=[];}catch(cause){error=errorMessage(cause);}finally{busy=false;}}
 async function update(){if(busy||!selectedIDs.length)return;const ids=[...selectedIDs],release={version,url,sha256:checksum};busy=true;error='';const failures:string[]=[];try{for(const id of ids){const server=demo.data.servers.find(s=>s.id===id);try{if(!server)throw new Error('服务器已移除');const reason=agentUpdateBlockReason(server);if(reason)throw new Error(reason);const result=await runAction('agent.update',id,'servers',release);submitted=[...submitted,id];selected=selected.filter(value=>value!==id);tasks=[...tasks,{server:server.name??id,id:result.task.id}];}catch(cause){failures.push(`${server?.name??id}：${errorMessage(cause)}`);}}if(failures.length)error=failures.join('；');}finally{busy=false;}}
</script>
<button class="button" onclick={()=>{open=true;error='';}}>升级 Agent</button>
<Modal bind:open title="Agent 版本与升级" description="使用明确版本与 SHA256 校验。升级期间会短暂断开；新 Agent 90 秒内未完成主控认证会自动恢复旧版。" wide>
 <div class="section-head"><span>已选 {selectedIDs.length} / 可升级 {eligible.length} 台</span><div class="actions"><button class="button small" disabled={busy||!eligible.length} onclick={()=>selected=eligible.map(server=>server.id)}>全选可升级节点</button><button class="button small" disabled={busy||!selected.length} onclick={()=>selected=[]}>取消全选</button></div></div>
 {#if needsMigration}<div class="hint space-top"><strong>{needsMigration} 台在线 Agent 尚未启用安全升级</strong><p>这些服务缺少升级监督进程，无法验证新版本并在失败时自动回退。需先在对应服务器保留原配置和数据，将 Agent 服务改为以 <code>-supervise</code> 启动；重新上线后点击“刷新版本状态”即可选择。</p></div>{/if}
 <div class="stack space-top">{#each demo.data.servers as server}{@const state=server.agentUpdate}{@const reason=submitted.includes(server.id)?'升级任务已提交':agentUpdateBlockReason(server)}<label class="tag" title={reason||'选择此服务器升级'}><input type="checkbox" bind:group={selected} value={server.id} disabled={busy||!!reason} aria-label={`选择 ${server.name} 升级`}/><strong>{server.name}</strong><span>{server.agentVersion??'未上报'} · Xray {server.core??'未上报'}</span><span>{reason||(state?.status?labels[state.status]??state.status:'支持升级')}</span>{#if state?.error}<small class="error">{state.error}</small>{/if}</label>{:else}<p class="hint">尚未接入任何服务器。</p>{/each}</div>
 <div class="form-grid space-top"><label class="field">Linux 服务器架构<AppSelect aria-label="Linux 服务器架构" bind:value={arch} onchange={()=>{url='';checksum='';}} options={[{value:'amd64',label:'x86_64 / amd64'},{value:'arm64',label:'aarch64 / arm64'}]}/></label><div class="field"><span>GitHub Release</span><button class="button" disabled={busy} onclick={loadRelease}>读取最新稳定版与校验值</button></div></div>
 <div class="form-grid space-top"><label class="field">目标版本<input bind:value={version} placeholder="例如 1.0.0"/></label><label class="field">SHA256<input bind:value={checksum} minlength="64" maxlength="64" spellcheck="false"/></label><label class="field full">适用于所选服务器架构的制品 URL<input type="url" bind:value={url} placeholder="https://…/aswired-agent"/></label></div>
 <p class="hint">内嵌 Xray 随 Agent 一起升级。从 ASWired-Release 读取版本和 SHA256；请按相同架构选择服务器，也可指定已校验的制品。任务成功表示制品就绪，最终以此处重新上线状态为准。</p>
 {#if error}<p class="error" role="alert">{error}</p>{/if}{#each tasks as task}<p class="hint">{task.server} · <a href={`/tasks?detail=${encodeURIComponent(task.id)}`}>查看升级任务</a></p>{/each}
 <div class="modal-actions"><button class="button" onclick={()=>open=false}>关闭</button><button class="button" disabled={busy} onclick={refresh}>刷新版本状态</button><button class="button primary" disabled={busy||!selectedIDs.length||!version||!url||checksum.length!==64} onclick={update}>{busy?'提交中…':'开始升级'}</button></div>
</Modal>
