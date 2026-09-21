<script lang="ts">
 import {onDestroy} from 'svelte';
 import Icon from './Icon.svelte';
 import Modal from './Modal.svelte';
 import {api,demo,errorMessage,refreshState,toast} from '../store.svelte';
 import {beijingDate,logDateRangeError,sameLogDateRange,type LogDeletePreview,type LogDeleteResult} from '../log-date-range';

 let {collection,onDeleted}=$props<{collection:string;onDeleted:()=>void}>();
 let open=$state(false),startDate=$state(''),endDate=$state(''),busy=$state(false),confirming=$state(false),error=$state('');
 let preview=$state<LogDeletePreview|null>(null);
 let requestID=0,disposed=false;
 const allowed=$derived(demo.user?.role==='admin'&&['tasks','audit'].includes(collection));
 onDestroy(()=>{disposed=true;requestID++;});

 function show(){
  if(!allowed||busy)return;
  requestID++;startDate=beijingDate();endDate=startDate;preview=null;error='';open=true;
 }
 function invalidate(){requestID++;preview=null;error='';}
 async function review(){
  if(!allowed||busy)return;
  preview=null;const range={startDate,endDate};error=logDateRangeError(range);if(error)return;
  const id=++requestID;const target=collection;busy=true;
  try{
   const result=await api<LogDeletePreview>(`/api/logs/${target}/preview`,{method:'POST',body:JSON.stringify(range)});
   if(disposed||!open||id!==requestID||collection!==target||!sameLogDateRange(range,{startDate,endDate}))return;
   if(!sameLogDateRange(result,range)||result.timeZone!=='Asia/Shanghai'||!result.fingerprint)throw new Error('预览结果已变化，请重新预览');
   preview=result;
  }catch(cause){if(!disposed&&open&&id===requestID)error=errorMessage(cause);}
  finally{busy=false;}
 }
 async function confirm(){
  if(!allowed||busy||!preview||preview.deletable===0||!sameLogDateRange(preview,{startDate,endDate}))return;
  const snapshot=preview;const target=collection;const userID=demo.user?.id;const id=++requestID;busy=true;confirming=true;error='';
  try{
   const result=await api<LogDeleteResult>(`/api/logs/${target}/delete`,{method:'POST',body:JSON.stringify({startDate:snapshot.startDate,endDate:snapshot.endDate,fingerprint:snapshot.fingerprint})});
   if(demo.user?.id!==userID)return;
   if(!disposed&&id===requestID){open=false;preview=null;}
   const message=`已删除 ${result.deleted} 条记录${result.protected?`，保留 ${result.protected} 条受保护记录`:''}`;
   try{await refreshState(true);if(demo.user?.id!==userID)return;if(!disposed)onDeleted();toast(message);}
   catch{if(demo.user?.id===userID)toast(message+'；列表刷新失败，请刷新页面');}
  }catch(cause){if(!disposed&&id===requestID){preview=null;error=errorMessage(cause);if(!open)toast(error);}}
  finally{busy=false;confirming=false;}
 }
</script>

{#if allowed}
 <button class="button danger" disabled={busy} onclick={show}><Icon name="trash"/>按日期删除</button>
 <Modal bind:open title="按日期删除" description={collection==='tasks'?'批量删除任务执行记录':'批量删除审计日志'}>
  <form onsubmit={event=>{event.preventDefault();if(!preview)review();}}>
   <div class="form-grid">
    <label class="field"><span>开始日期</span><input type="date" bind:value={startDate} max={endDate||undefined} required disabled={busy} oninput={invalidate}/></label>
    <label class="field"><span>结束日期</span><input type="date" bind:value={endDate} min={startDate||undefined} required disabled={busy} oninput={invalidate}/></label>
   </div>
   <p class="hint space-top">按创建日期计算，包含首尾两天（北京时间）。范围内的所有记录均会纳入，不受当前搜索、状态筛选和分页限制。</p>
   {#if preview}
    <section class="delete-preview space-top" aria-live="polite">
     <p>{preview.startDate} 至 {preview.endDate}</p>
     <div class="delete-counts"><span>匹配 <strong>{preview.total}</strong> 条</span><span>可删除 <strong>{preview.deletable}</strong> 条</span><span>受保护 <strong>{preview.protected}</strong> 条</span></div>
     {#if preview.deletable}<p class="hint">删除后无法恢复。{collection==='tasks'?'已应用的配置会继续生效，仍被使用的任务记录会保留。':'原有操作及其结果不会撤销。'}</p>{:else}<p class="hint">{preview.total?'此范围内的记录均受到保护，暂不能删除。':'此日期范围内没有记录。'}</p>{/if}
    </section>
   {/if}
   {#if error}<p class="error" role="alert">{error}</p>{/if}
   <div class="modal-actions">
    <button type="button" class="button" disabled={busy} onclick={()=>open=false}>取消</button>
    {#if preview}<button type="button" class="button" disabled={busy} onclick={review}>重新预览</button><button type="button" class="button danger" disabled={busy||preview.deletable===0} onclick={confirm}>{confirming?'删除中…':`确认删除 ${preview.deletable} 条`}</button>{:else}<button type="submit" class="button primary" disabled={busy||!startDate||!endDate}>{busy?'正在预览…':'预览删除范围'}</button>{/if}
   </div>
  </form>
 </Modal>
{/if}

<style>
 .delete-preview{border:1px solid var(--border);border-radius:12px;padding:1rem}.delete-preview p{margin:0}.delete-counts{display:flex;flex-wrap:wrap;gap:.6rem 1.25rem;margin:.75rem 0}.delete-counts strong{font-variant-numeric:tabular-nums}
</style>
