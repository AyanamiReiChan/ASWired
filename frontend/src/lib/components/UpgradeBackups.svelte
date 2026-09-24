<script lang="ts">
 import {onMount,untrack} from 'svelte';
 import Modal from './Modal.svelte';
 import Icon from './Icon.svelte';
 import {api,demo} from '../store.svelte';
 import {createUpgradeBackups,backupOperationPending,type UpgradeBackup} from '../upgrade-backups.svelte';
 let {updating=false}=$props<{updating?:boolean}>();
 let mounted=$state(false),confirmOpen=$state(false),confirmation=$state(''),selected=$state<UpgradeBackup|null>(null);
 const identity=$derived(demo.user?.role==='admin'?demo.user.id+':admin':'');
 const backups=createUpgradeBackups({request:api,identity:()=>identity,updating:()=>updating,visible:()=>!document.hidden});
 const status=$derived(backups.state.status),pending=$derived(backupOperationPending(status));
 const busy=$derived(backups.state.loading||backups.state.submitting);
 const statusText=$derived(status?.phase==='queued'?'请求已排队，等待执行':status?.phase==='scanning'?'正在读取升级备份列表':status?.phase==='deleting'?'正在删除升级备份':status?.phase==='completed'?(status.operation==='delete'?'删除已完成':'备份列表已更新'):status?.phase==='failed'?'升级备份操作失败':'');
 const currentSelection=$derived(status?.items.find(item=>item.id===selected?.id));
 $effect(()=>{
  const user=identity,ready=mounted;
  untrack(()=>{backups.syncIdentity();confirmOpen=false;confirmation='';selected=null;if(ready&&user)void backups.start();});
 });
 onMount(()=>{
  mounted=true;
  const resume=()=>{if(!document.hidden)void backups.resume();};
  document.addEventListener('visibilitychange',resume);
  return()=>{backups.stop();document.removeEventListener('visibilitychange',resume);};
 });
 function size(value:number){if(!Number.isFinite(value)||value<0)return '—';const units=['B','KiB','MiB','GiB','TiB','PiB'];let index=0;while(index<units.length-1&&value>=1024**(index+1))index++;return `${Number((value/1024**index).toFixed(2))} ${units[index]}`;}
 function date(value:string|undefined){if(!value)return '时间未知';const at=new Date(value);return Number.isFinite(at.getTime())?at.toLocaleString('zh-CN',{hour12:false}):'时间未知';}
 function review(item:UpgradeBackup){if(!backups.canRemove(item.id))return;selected=item;confirmation='';confirmOpen=true;}
 async function remove(){if(!selected)return;if(await backups.remove(selected.id,confirmation)){confirmOpen=false;confirmation='';selected=null;}}
</script>

<section class="upgrade-backups space-top" aria-label="系统升级备份" aria-busy={busy}>
 <div class="section-head backup-heading"><div><h3>系统升级备份</h3><p class="muted">升级前保留的主控、Komari 与部署配置备份。</p></div><button class="button" disabled={busy||!identity} onclick={()=>backups.refresh()}><Icon name="refresh" size={15}/>{pending||backups.state.needsVerification?'刷新状态':'刷新列表'}</button></div>
 {#if !identity}<p class="hint">只有管理员可以管理系统升级备份。</p>{:else}
  {#if backups.state.error}<p class="error" role="alert">{backups.state.error}</p>{/if}
  {#if status?.supported===false}<p class="hint">{status.reason||'当前安装不支持管理系统升级备份。'}</p>{/if}
  {#if statusText}<p class:failure={status?.phase==='failed'} class="backup-status" role={status?.phase==='failed'?'alert':'status'}><strong>{statusText}</strong>{#if status?.message}<span>{status.message}</span>{/if}{#if pending}<span>请求受理后仍需等待执行完成，列表以完成后的结果为准。</span>{/if}</p>{/if}
  {#if updating}<p class="hint">系统升级进行中，暂不能删除升级备份。</p>{/if}
  {#if status}
   <div class="backup-summary"><span>{status.items.length} 份备份</span><strong>{status.truncated?'当前列表合计':'合计'} {size(status.totalSizeBytes)}</strong>{#if status.updatedAt}<small>状态更新：{date(status.updatedAt)}</small>{/if}</div>
   {#if status.truncated}<p class="hint">{status.remainingCount?`另有 ${status.remainingCount} 份备份未列出。`:'还有备份未列出。'}合计空间仅包含当前列表中的备份。</p>{/if}
   <div class="backup-list">
    {#each status.items as item (item.id)}
     <article class="backup-item"><div class="backup-item-heading"><div><time datetime={item.createdAt}>{date(item.createdAt)}</time><code class="backup-id">{item.id}</code></div><strong class="backup-size">{size(item.sizeBytes)}</strong></div>
      <div class="backup-meta"><span>升级前版本：{item.previousVersion||'未知'}</span><button class="button small danger" disabled={!backups.canRemove(item.id)} onclick={()=>review(item)}>删除备份</button></div>
      {#if !item.deletable}<p class="backup-reason">{item.reason||'该备份暂不可删除。'}</p>{/if}
      <details class="backup-files"><summary>文件清单（{item.files.length}）</summary><ul>{#each item.files as file}<li><code>{file.name}</code><span>{size(file.sizeBytes)}</span></li>{:else}<li>暂无文件详情</li>{/each}</ul></details>
     </article>
    {:else}<div class="backup-empty">{pending?'正在等待备份清单…':status.phase==='failed'?'未能取得备份清单，请查看错误后重试。':status.supported?'暂无系统升级备份。':'当前没有可展示的升级备份。'}</div>{/each}
   </div>
  {:else if busy}<p class="hint" role="status">正在读取升级备份状态…</p>{/if}
 {/if}
</section>

<Modal bind:open={confirmOpen} title="删除系统升级备份" description="将永久删除这一份升级备份及其全部文件，之后无法再用它回退。">
 {#if selected}<div class="backup-confirm"><strong>{date(selected.createdAt)}</strong><code>{selected.id}</code><span>升级前版本：{selected.previousVersion||'未知'} · 占用 {size(selected.sizeBytes)}</span></div><label class="field space-top">输入完整备份 ID 确认删除<input bind:value={confirmation} autocomplete="off" spellcheck="false" disabled={busy} placeholder={selected.id}/></label>
  {#if !currentSelection||!backups.canRemove(selected.id)}<p class="hint">{updating?'系统正在升级，请稍后再删除。':currentSelection?.reason||'备份状态已变化或操作仍在进行，请关闭窗口并刷新列表。'}</p>{/if}
  {#if backups.state.error}<p class="error" role="alert">{backups.state.error}</p>{/if}
  <div class="modal-actions"><button class="button" disabled={busy} onclick={()=>{confirmOpen=false;confirmation='';}}>取消</button><button class="button danger" disabled={busy||confirmation!==selected.id||!backups.canRemove(selected.id)} onclick={remove}>{backups.state.submitting?'正在提交…':'确认永久删除'}</button></div>
 {/if}
</Modal>

<style>
 .upgrade-backups{min-width:0;border-top:1px solid var(--line);padding-top:1.2rem}.backup-heading{align-items:flex-start;flex-wrap:wrap}.backup-heading h3{font-size:.95rem}.backup-heading p{font-size:.75rem;margin-top:.4rem;line-height:1.6}.backup-summary{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;padding:.9rem 0;font-size:.78rem}.backup-summary small{color:var(--muted);margin-left:auto}.backup-list{display:grid;gap:.75rem;min-width:0}.backup-item{border:1px solid var(--line);border-radius:.6rem;padding:1rem;min-width:0}.backup-item-heading,.backup-meta{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem}.backup-item-heading>div{min-width:0}.backup-item time{font-size:.8rem}.backup-id{display:block;font-size:.72rem;color:var(--muted);margin-top:.35rem;overflow-wrap:anywhere}.backup-size{font-size:.9rem;white-space:nowrap}.backup-meta{align-items:center;margin-top:.85rem;flex-wrap:wrap;font-size:.74rem}.backup-meta>span{overflow-wrap:anywhere;min-width:0}.backup-reason{color:var(--muted);font-size:.72rem;margin-top:.6rem;line-height:1.5}.backup-files{border-top:1px solid var(--line);margin-top:.85rem;padding-top:.7rem;font-size:.73rem}.backup-files summary{cursor:pointer;color:var(--muted)}.backup-files ul{list-style:none;padding:0;margin:.6rem 0 0;display:grid;gap:.5rem}.backup-files li{display:flex;justify-content:space-between;gap:1rem;min-width:0}.backup-files code{overflow-wrap:anywhere;min-width:0}.backup-files li span{white-space:nowrap;color:var(--muted)}.backup-status{display:grid;gap:.35rem;font-size:.77rem;line-height:1.6;padding:.85rem;border:1px solid var(--line);border-radius:.5rem;overflow-wrap:anywhere}.backup-status span{color:var(--muted)}.backup-status.failure{color:var(--danger)}.backup-empty{padding:1.5rem .5rem;color:var(--muted);font-size:.8rem}.backup-confirm{display:grid;gap:.6rem;font-size:.8rem;overflow-wrap:anywhere}.backup-confirm span{color:var(--muted);line-height:1.6}.modal-actions{flex-wrap:wrap}
 @media(max-width:600px){.backup-item{padding:.85rem}.backup-item-heading{flex-wrap:wrap}.backup-summary small{margin-left:0;flex-basis:100%}.backup-heading>button{width:100%}}
</style>
