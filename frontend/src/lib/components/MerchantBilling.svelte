<script lang="ts">
 import AppSelect from "./Select.svelte";
 import Modal from './Modal.svelte';
 import {demo,errorMessage,refreshState,api} from '../store.svelte';
 let open=$state(false),serverId=$state(''),error=$state(''),busy=$state(false),loading=$state(false);
 let config=$state({source:'system',direction:'sum',resetDay:1,resetTime:'00:00',timezone:'Asia/Shanghai',limitGB:0,revision:''});
 let snapshot=$state<any>(null),usedGB=$state<number|undefined>(),reason=$state('');
 const directions:Record<string,string>={sum:'上传＋下载',upload:'仅上传',download:'仅下载',max:'上传、下载取较大值'};
 const gb=(value:unknown)=>(Number(value??0)/1e9).toLocaleString('zh-CN',{maximumFractionDigits:4});
 const stamp=(value:unknown)=>value?new Date(String(value)).toLocaleString('zh-CN'):'等待样本';
 async function load(){if(!serverId)return;error='';loading=true;snapshot=null;const id=serverId;try{const result=await api(`/api/servers/${encodeURIComponent(id)}/billing`);if(id!==serverId)return;snapshot=result;const saved=snapshot.config;config={source:saved?.source??'system',direction:saved?.direction??'sum',resetDay:saved?.resetDay??1,resetTime:saved?.resetTime??'00:00',timezone:saved?.timezone??'Asia/Shanghai',limitGB:saved?.limitGB??0,revision:saved?.revision??''};}catch(cause){if(id===serverId)error=errorMessage(cause);}finally{if(id===serverId)loading=false;}}
 async function save(){if(busy||loading||!snapshot)return;busy=true;error='';try{await api(`/api/servers/${encodeURIComponent(serverId)}/billing`,{method:'POST',body:JSON.stringify(config)});await load();await refreshState();}catch(cause){error=errorMessage(cause);}finally{busy=false;}}
 async function calibrate(){if(busy||loading||!snapshot?.current||usedGB===undefined)return;busy=true;error='';try{const latest:any=await api(`/api/servers/${encodeURIComponent(serverId)}/billing`);if(latest.current?.revision!==snapshot.current?.revision||latest.current?.start!==snapshot.current?.start)throw new Error('账期或统计口径已改变，请刷新后重新核对用量');await api(`/api/servers/${encodeURIComponent(serverId)}/billing/calibrate`,{method:'POST',body:JSON.stringify({usedGB,reason,revision:latest.current?.revision,sampleAt:latest.current?.sampleAt,cycleStart:snapshot.current?.start})});reason='';usedGB=undefined;await load();await refreshState();}catch(cause){error=errorMessage(cause);}finally{busy=false;}}
</script>
<button class="button" onclick={()=>{open=true;serverId=serverId||demo.data.servers[0]?.id||'';load();}}>商家账期与流量</button>
<Modal bind:open title="商家账期与流量" description="独立记录服务器用量。所有 GB 均按 1,000,000,000 字节计算。" wide>
 <label class="field">服务器<AppSelect aria-label="计费服务器" bind:value={serverId} onchange={()=>{snapshot=null;usedGB=undefined;reason='';load();}} disabled={busy||loading} options={demo.data.servers.map(server=>({value:server.id,label:server.name}))}/></label>
 {#if loading}<p class="hint" role="status">正在读取账期…</p>{/if}
 <div class="form-grid space-top">
  <label class="field">统计来源<AppSelect aria-label="统计来源" bind:value={config.source} disabled={busy||loading} options={[{value:'system',label:'系统探针累计流量'},{value:'xray',label:'Xray 原始用户流量（不含倍率）'}]}/></label>
  <label class="field">商家计费方向<AppSelect aria-label="商家计费方向" bind:value={config.direction} disabled={busy||loading} options={Object.entries(directions).map(([value,label])=>({value,label}))}/></label>
  <label class="field">每月重置日<input type="number" min="1" max="31" step="1" bind:value={config.resetDay} disabled={busy||loading}/></label>
  <label class="field">重置时间<input type="time" bind:value={config.resetTime} disabled={busy||loading}/></label>
  <label class="field">账期时区<input bind:value={config.timezone} disabled={busy||loading}/></label>
  <label class="field">每月额度 / GB<input type="number" min="0" step="any" bind:value={config.limitGB} disabled={busy||loading}/></label>
 </div>
 <p class="hint">按所选时区和时间重置；当月没有该日期则按月末。上传、下载均以服务器视角计算。系统来源跟随服务器所选探针。</p>
 <p class="hint">保存设置将开始新的统计区段，保留旧账本；本账期已有用量请重新按商家数据校准。</p>
 <div class="actions"><button class="button primary" disabled={busy||loading||!snapshot||!serverId} onclick={save}>保存并开始统计</button><button class="button" disabled={busy||loading||!serverId} onclick={load}>刷新账本</button></div>
 {#if snapshot?.current}{@const current=snapshot.current}
  <section class="card padded space-top"><h3>当前账期 · {gb(current.usedBytes)} / {current.limitGB||'不限'} GB</h3><p class="hint">{stamp(current.start)} 至 {stamp(current.end)} · {directions[current.direction]} · {current.source==='xray'?'Xray 原始流量':'系统探针'}</p><p class="hint">最后样本 {stamp(current.sampleAt)} · 采集上传 {gb(current.uploadBytes)} GB / 下载 {gb(current.downloadBytes)} GB</p>{#if current.gap}<p class="hint">{current.gapReason}</p>{/if}
   <div class="form-grid space-top"><label class="field">商家当前已用 / GB<input type="number" min="0" step="any" bind:value={usedGB} disabled={busy||loading}/></label><label class="field">校准依据<input bind:value={reason} placeholder="例如商家面板今日 14:30 用量" disabled={busy||loading}/></label></div>
   <p class="hint">校准立即作用于当前账期，并保存原值、差额和操作者；后续采样继续累加。不会修改成员套餐计费。</p>
   <button class="button" disabled={busy||loading||usedGB===undefined||!reason.trim()} onclick={calibrate}>按商家用量校准</button>
  </section>
 {/if}
 {#if snapshot?.history?.length}<h3 class="space-top">账本历史</h3><div class="table-scroll"><table><thead><tr><th>账期开始</th><th>来源 / 方向</th><th>用量 GB</th><th>校准差额 GB</th></tr></thead><tbody>{#each snapshot.history as item}<tr><td>{stamp(item.start)}</td><td>{item.source==='xray'?'Xray':'系统'} · {directions[item.direction]}</td><td>{gb(item.usedBytes)}</td><td>{gb(item.adjustmentBytes)}</td></tr>{/each}</tbody></table></div>{/if}
 {#if snapshot?.adjustments?.length}<h3 class="space-top">校准记录</h3>{#each snapshot.adjustments as item}<p class="hint">{stamp(item.at)} · {item.actor} · {gb(item.beforeBytes)} → {gb(item.targetBytes)} GB · {item.reason}</p>{/each}{/if}
 {#if error}<p class="error" role="alert">{error}</p>{/if}
 <div class="modal-actions"><button class="button" onclick={()=>open=false}>关闭</button></div>
</Modal>
