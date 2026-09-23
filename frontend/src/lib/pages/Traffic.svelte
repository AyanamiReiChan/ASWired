<script lang="ts">
 import {formatNumber} from '../format';
 import {formatTrafficBytes} from '../traffic-chart';
 import TrafficChart from '../components/TrafficChart.svelte';
 import Icon from '../components/Icon.svelte';
 import Modal from '../components/Modal.svelte';
 import AppSelect from '../components/Select.svelte';
 import type {Row} from '../data';
 import {demo,percent,simulateJob,download,toast,errorMessage,listInternalTransfers,saveInternalTransfer,removeInternalTransfer,type InternalTransfer} from '../store.svelte';

 let period=$state('1小时'),scope=$state('按服务器');
 let editorOpen=$state(false),settingsOpen=$state(false),removeOpen=$state(false),busy=$state(false),loading=$state(false),error=$state(''),settingsError=$state('');
 let form=$state({serverId:'',email:'',name:'',sourceServerId:''}),lockedAccount=$state(false);
 let classifications=$state<InternalTransfer[]>([]),removeTarget=$state<{id:string;name:string}|null>(null);
 const rows=$derived(scope==='按服务器'?demo.data.trafficServers:scope==='按成员'?demo.data.trafficMembers:scope==='内部中转'?demo.data.trafficInternal:demo.data.trafficUnassigned);
 const detailed=$derived(scope==='内部中转'||scope==='未归属');
 const serverOptions=$derived(demo.data.servers.map(row=>({value:row.id,label:row.name||row.id})));
 const totalBytes=$derived(rows.reduce((total,row)=>total+Number(row.up??0)+Number(row.down??0),0));
 const admin=$derived(demo.user?.role==='admin');

 function serverName(id:string){return demo.data.servers.find(row=>row.id===id)?.name||id||'未知节点';}
 function bytes(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0?formatTrafficBytes(value):'—';}
 function edit(row?:Row|InternalTransfer){
  settingsOpen=false;error='';lockedAccount=!!row;
  form={serverId:row?.serverId??'',email:row?.email??'',name:row?.name??'',sourceServerId:row?.sourceServerId??''};
  editorOpen=true;
 }
 async function openSettings(){
  settingsOpen=true;settingsError='';classifications=[];loading=true;
  try{classifications=await listInternalTransfers();}catch(cause){settingsError=errorMessage(cause);}finally{loading=false;}
 }
 async function save(){
  if(busy)return;
  error='';
  if(!form.serverId||!form.email.trim()||!form.name.trim()){error='请选择落地节点，并填写账号标识和线路名称';return;}
  if(form.sourceServerId===form.serverId){error='来源节点与落地节点不能相同';return;}
  busy=true;
  try{
   const saved=await saveInternalTransfer({serverId:form.serverId,email:form.email.trim(),name:form.name.trim(),...(form.sourceServerId?{sourceServerId:form.sourceServerId}:{})});
   if(saved){editorOpen=false;scope='内部中转';toast('内部中转分类已保存');}
  }catch(cause){error=errorMessage(cause);}finally{busy=false;}
 }
 function confirmRemove(row:Row|InternalTransfer){
  settingsOpen=false;error='';removeTarget={id:('classificationId' in row?row.classificationId:null)??row.id,name:row.name};removeOpen=true;
 }
 async function remove(){
  if(busy||!removeTarget)return;
  busy=true;error='';
  try{if(await removeInternalTransfer(removeTarget.id)){removeOpen=false;toast('已取消内部中转分类');}}
  catch(cause){error=errorMessage(cause);}finally{busy=false;}
 }
 function exportTraffic(){
  const exported=rows.map(row=>detailed?{name:row.name,server_id:row.serverId,server_name:row.serverName,email:row.email,source_server_id:row.sourceServerId,source_server_name:row.sourceServerName,up_bytes:row.up,down_bytes:row.down,used_gb:row.used,classification:scope==='内部中转'?'internal_transfer':'unassigned'}:{name:row.name,used_gb:row.used,limit_gb:row.limit});
  download('traffic.json',JSON.stringify(exported,null,2),'application/json');
 }
</script>

<div class="page-head"><div><div class="eyebrow">运维 / 用量</div><h1>流量分析</h1><p>看清流量流向，也看清统计的边界。</p></div><div class="actions"><button class="button" onclick={exportTraffic}><Icon name="download"/>导出</button><button class="button primary" onclick={()=>simulateJob('traffic.reconcile','全部自建节点')}>流量对账</button></div></div>
{#if demo.trafficError}<div class="status-banner" role="alert">{demo.trafficError}</div>{:else if demo.trafficIncomplete}<div class="status-banner">部分记录存在统计缺口或历史归属未确认；已接收流量已计入。</div>{/if}
<div class="card padded"><div class="section-head traffic-head"><div><h2>分钟趋势</h2><p class="muted">上传 + 下载 · 每分钟实际汇总</p></div><div class="segmented">{#each ['1小时','6小时','24小时'] as p}<button class:active={period===p} onclick={()=>period=p}>{p}</button>{/each}</div></div><TrafficChart {period}/></div>
<p class="hint space-top">以下用量为最近 30 天汇总。</p>
<div class="tabs space-top" aria-label="流量分类">{#each ['按服务器','按成员','内部中转','未归属'] as tab}<button class:active={scope===tab} aria-pressed={scope===tab} onclick={()=>scope=tab}>{tab}</button>{/each}</div>
{#if detailed}
 <div class="section-head traffic-head"><div><h2>{scope}流量</h2><p class="muted">{rows.length} 个账号 · 合计 {bytes(totalBytes)}</p></div>{#if admin}<button class="button" onclick={openSettings}>内部中转分类设置</button>{/if}</div>
 <p class="hint traffic-note">{scope==='内部中转'?'内部账号记录中转线路在落地节点上的流量，保留在服务器统计中，不重复扣减成员额度。':'这些账号尚未匹配到成员订阅。确认属于节点之间的内部中转后，可以单独分类。'}</p>
 <div class="card no-pad"><div class="table-scroll"><table class="detail-table"><thead><tr>{#if scope==='内部中转'}<th>线路</th>{/if}<th>落地节点</th><th>账号标识</th><th>上传</th><th>下载</th><th>合计</th>{#if admin}<th>操作</th>{/if}</tr></thead><tbody>
  {#each rows as row (row.id)}
   <tr>{#if scope==='内部中转'}<td><strong>{row.name}</strong>{#if row.sourceServerName||row.sourceServerId}<small class="row-detail">来源：{row.sourceServerName||serverName(row.sourceServerId)}</small>{/if}</td>{/if}<td>{row.serverName||serverName(row.serverId)}</td><td><code class="account-id">{row.email}</code></td><td class="byte-cell">{bytes(row.up)}</td><td class="byte-cell">{bytes(row.down)}</td><td class="byte-cell">{bytes(Number(row.up??0)+Number(row.down??0))}</td>{#if admin}<td>{#if scope==='内部中转'}<button class="button small" disabled={!row.classificationId||busy} onclick={()=>confirmRemove(row)}>取消分类</button>{:else}<button class="button small" disabled={busy} onclick={()=>edit(row)}>标记为内部中转</button>{/if}</td>{/if}</tr>
  {:else}<tr><td colspan={(scope==='内部中转'?6:5)+(admin?1:0)}><div class="empty">{!demo.trafficLoaded?'正在加载流量…':demo.trafficError?'流量暂不可用，请稍后重试':scope==='内部中转'?'最近 30 天暂无内部中转流量':'暂无未归属账号明细'}</div></td></tr>{/each}
 </tbody></table></div></div>
{:else}
 <div class="card no-pad"><div class="table-scroll"><table><thead><tr><th>对象</th><th>已用</th><th>额度</th><th>使用比例</th><th>来源</th></tr></thead><tbody>{#each rows as row}<tr><td>{row.name}</td><td>{formatNumber(row.used)} GB</td><td>{row.limit==null?'—':row.limit===0?'不限':`${formatNumber(row.limit)} GB`}</td><td><div class="cell-progress"><span>{row.limit==null?'—':row.limit===0?'不限':`${percent(row.used,row.limit)}%`}</span>{#if row.limit>0}<div class="progress thin"><i style={`width:${percent(row.used,row.limit)}%`}></i></div>{/if}</div></td><td>{scope==='按服务器'?'原始 Xray 代理流量':'加权 Xray 用户流量'}</td></tr>{:else}<tr><td colspan="5"><div class="empty">{!demo.trafficLoaded?'正在加载流量…':'暂无流量记录'}</div></td></tr>{/each}</tbody></table></div></div>
{/if}
<p class="hint space-top">服务器流量与用户流量分别统计。网卡监控指标不代替 Xray 用户流量；尚未采集的数据标为未知。</p>

{#if admin}
 <Modal bind:open={settingsOpen} title="内部中转分类设置" description="按落地节点和账号标识识别内部流量。没有近期流量的分类也会保留。" wide>
  {#if settingsError}<p class="error" role="alert">{settingsError}</p>{/if}
  {#if loading}<div class="empty">正在加载分类…</div>{:else if classifications.length}<div class="table-scroll"><table><thead><tr><th>线路</th><th>落地节点</th><th>账号标识</th><th>操作</th></tr></thead><tbody>{#each classifications as item (item.id)}<tr><td>{item.name}{#if item.sourceServerId}<small class="row-detail">来源：{serverName(item.sourceServerId)}</small>{/if}</td><td>{serverName(item.serverId)}</td><td><code class="account-id">{item.email}</code></td><td><div class="actions"><button class="button small" onclick={()=>edit(item)}>编辑</button><button class="button small" onclick={()=>confirmRemove(item)}>取消分类</button></div></td></tr>{/each}</tbody></table></div>{:else if !settingsError}<div class="empty">尚未设置内部中转账号</div>{/if}
  <div class="modal-actions"><button class="button" onclick={()=>settingsOpen=false}>关闭</button><button class="button primary" onclick={()=>edit()}><Icon name="plus"/>添加内部账号</button></div>
 </Modal>
 <Modal bind:open={editorOpen} title="设置内部中转账号" description="仅将已确认的节点间账号设为内部中转。分类会同时用于已有记录和后续流量。">
  <form onsubmit={event=>{event.preventDefault();void save();}}><fieldset disabled={busy} class="form-grid classification-fields">
   <label class="field full">线路名称<input bind:value={form.name} maxlength="120" required placeholder="例如：入口节点 → 落地节点"/></label>
   <label class="field">来源节点（可选）<AppSelect bind:value={form.sourceServerId} options={[{value:'',label:'暂不指定'},...serverOptions.filter(option=>option.value!==form.serverId)]} aria-label="来源节点" disabled={busy}/></label>
   <label class="field">落地节点<AppSelect bind:value={form.serverId} options={serverOptions} aria-label="落地节点" disabled={lockedAccount||busy} required/>{#if lockedAccount}<small>{serverName(form.serverId)}</small>{/if}</label>
   <label class="field full">账号标识<input bind:value={form.email} maxlength="320" required readonly={lockedAccount} placeholder="Xray 用户 email 标识"/><small>与该落地节点上报的账号标识完全一致。</small></label>
  </fieldset>{#if error}<p class="error" role="alert">{error}</p>{/if}<div class="modal-actions"><button class="button" type="button" disabled={busy} onclick={()=>editorOpen=false}>取消</button><button class="button primary" disabled={busy}>{busy?'保存中…':'保存分类'}</button></div></form>
 </Modal>
 <Modal bind:open={removeOpen} title="取消内部中转分类" description="取消后，该账号未匹配到成员的流量会重新显示为未归属。">
  <p>确认取消「{removeTarget?.name}」的内部中转分类？</p><p class="hint space-top">此操作保留已有流量记录，不会追扣成员额度。</p>{#if error}<p class="error" role="alert">{error}</p>{/if}<div class="modal-actions"><button class="button" disabled={busy} onclick={()=>removeOpen=false}>保留分类</button><button class="button danger" disabled={busy} onclick={remove}>{busy?'处理中…':'确认取消分类'}</button></div>
 </Modal>
{/if}

<style>
 .traffic-head{flex-wrap:wrap}.traffic-head .muted{font-size:.8rem}.traffic-note{margin-bottom:1rem}.row-detail{display:block;margin-top:.35rem;color:var(--muted);font-size:.7rem}.account-id{overflow-wrap:anywhere;white-space:normal}.byte-cell{white-space:nowrap;font-variant-numeric:tabular-nums}.detail-table{min-width:48rem}.classification-fields{border:0;padding:0;margin:0;min-width:0}
 @media(max-width:640px){.classification-fields{grid-template-columns:1fr}.modal-actions{flex-wrap:wrap}}
</style>
