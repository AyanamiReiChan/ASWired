<script lang="ts">
 import AppSelect from "./Select.svelte";
 import Modal from './Modal.svelte';import {demo,runAction,errorMessage,refreshState} from '../store.svelte';
 let open=$state(false),selected=$state<string[]>([]),version=$state(''),url=$state(''),checksum=$state(''),busy=$state(false),error=$state(''),tasks=$state<{server:string;id:string}[]>([]);
 let arch=$state('amd64');
 async function loadRelease(){if(busy)return;busy=true;error='';try{const result=await runAction('system.update',undefined,undefined,{channel:'stable'});const asset=result.agents?.[arch];if(!asset)throw new Error('该发行版没有对应架构的 Agent');version=result.version.replace(/^v/,'');url=asset.url;checksum=asset.sha256;}catch(cause){error=errorMessage(cause);}finally{busy=false;}}
 const labels:Record<string,string>={staged:'制品已校验',ready:'等待重启',restarting:'新版本验证中',healthy:'已重新认证',completed:'升级成功',rolled_back:'已自动回退',failed:'升级失败'};
 async function update(){if(busy)return;busy=true;error='';const failures:string[]=[];try{for(const id of selected){const server=demo.data.servers.find(s=>s.id===id);try{const result=await runAction('agent.update',id,'servers',{version,url,sha256:checksum});tasks=[...tasks,{server:server?.name??id,id:result.task.id}];}catch(cause){failures.push(`${server?.name??id}：${errorMessage(cause)}`);}}if(failures.length)error=failures.join('；');}finally{busy=false;}}
</script>
<button class="button" onclick={()=>{open=true;error='';}}>升级 Agent</button>
<Modal bind:open title="Agent 版本与升级" description="使用明确版本与 SHA256 校验。升级期间会短暂断开；新 Agent 90 秒内未完成主控认证会自动恢复旧版。" wide>
 <div class="stack">{#each demo.data.servers as server}{@const state=server.agentUpdate}<label class="tag"><input type="checkbox" bind:group={selected} value={server.id} disabled={!server.capabilities?.agent_update||server.status!=='在线'}/><strong>{server.name}</strong><span>{server.agentVersion??'未上报'} · Xray {server.core??'未上报'}</span><span>{state?.status?labels[state.status]??state.status:server.capabilities?.agent_update?'支持升级':'需更新服务安装'}</span>{#if state?.error}<small class="error">{state.error}</small>{/if}</label>{/each}</div>
 <div class="form-grid space-top"><label class="field">Linux 服务器架构<AppSelect aria-label="Linux 服务器架构" bind:value={arch} onchange={()=>{url='';checksum='';}} options={[{value:'amd64',label:'x86_64 / amd64'},{value:'arm64',label:'aarch64 / arm64'}]}/></label><div class="field"><span>GitHub Release</span><button class="button" disabled={busy} onclick={loadRelease}>读取最新稳定版与校验值</button></div></div>
 <div class="form-grid space-top"><label class="field">目标版本<input bind:value={version} placeholder="例如 1.0.0"/></label><label class="field">SHA256<input bind:value={checksum} minlength="64" maxlength="64" spellcheck="false"/></label><label class="field full">适用于所选服务器架构的制品 URL<input type="url" bind:value={url} placeholder="https://…/aswired-agent"/></label></div>
 <p class="hint">内嵌 Xray 随 Agent 一起升级。从 ASWired-Release 读取版本和 SHA256；请按相同架构选择服务器，也可指定已校验的制品。任务成功表示制品就绪，最终以此处重新上线状态为准。</p>
 {#if error}<p class="error" role="alert">{error}</p>{/if}{#each tasks as task}<p class="hint">{task.server} · <a href={`/tasks?detail=${encodeURIComponent(task.id)}`}>查看升级任务</a></p>{/each}
 <div class="modal-actions"><button class="button" onclick={()=>open=false}>关闭</button><button class="button" disabled={busy} onclick={()=>refreshState()}>刷新版本状态</button><button class="button primary" disabled={busy||!selected.length||!version||!url||checksum.length!==64} onclick={update}>{busy?'提交中…':'开始升级'}</button></div>
</Modal>
