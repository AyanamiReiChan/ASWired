<script lang="ts">
 import {api,copy,errorMessage} from '../store.svelte';
 import Modal from './Modal.svelte';
 let open=$state(false),rows=$state<any[]>([]),name=$state(''),days=$state(7),code=$state(''),busy=$state(false),error=$state('');
 $effect(()=>{if(!open)code='';});
 const time=(value:string)=>value?new Date(value).toLocaleString():'—';
 const status=(row:any)=>row.status==='active'&&Date.parse(row.expiresAt)<=Date.now()?'expired':row.status;
 const labels:Record<string,string>={active:'待使用',used:'已使用',revoked:'已撤销',expired:'已过期'};
 async function load(){const result=await api('/api/registration-invites');rows=result.rows.reverse();}
 async function show(){open=true;busy=true;error='';try{await load();}catch(cause){error=errorMessage(cause);}finally{busy=false;}}
 async function create(){if(busy)return;busy=true;error='';try{const result=await api('/api/registration-invites',{method:'POST',body:JSON.stringify({name,expiresInDays:days})});code=result.code;name='';await load();}catch(cause){error=errorMessage(cause);}finally{busy=false;}}
 async function revoke(id:string){if(busy)return;busy=true;error='';try{await api(`/api/registration-invites/${encodeURIComponent(id)}`,{method:'DELETE'});await load();}catch(cause){error=errorMessage(cause);}finally{busy=false;}}
</script>
<section class="card invite-entry"><div><strong>注册邀请码</strong><p class="muted">邀请新成员创建普通账户。套餐通过兑换码另行分配。</p></div><button class="button" onclick={show}>管理注册邀请码</button></section>
<Modal bind:open title="注册邀请码" description="每个邀请码仅可注册一个普通账户，到期后自动失效。" wide>
 <form onsubmit={event=>{event.preventDefault();create();}} class="invite-form"><label class="field">备注<input bind:value={name} maxlength="40" placeholder="例如：邀请张三" disabled={busy}/></label><label class="field">有效期 / 天<input type="number" min="1" max="90" step="1" required bind:value={days} disabled={busy}/></label><button class="button primary" disabled={busy}>{busy?'处理中…':'生成邀请码'}</button></form>
 {#if code}<div class="invite-code" role="status"><p>邀请码仅在本次管理窗口中显示，请复制保存后交给受邀者。</p><div><code>{code}</code><button class="button small" onclick={()=>copy(code)}>复制邀请码</button></div></div>{/if}
 {#if error}<p class="error" role="alert">{error}</p>{/if}
 <div class="invite-list">{#each rows as row(row.id)}<article><div><strong>{row.name||'未填写备注'}</strong><p>{labels[status(row)]} · 有效至 {time(row.expiresAt)}</p>{#if row.usedUsername}<p>注册用户：{row.usedUsername} · {time(row.usedAt)}</p>{/if}</div>{#if status(row)==='active'}<button class="button small" disabled={busy} onclick={()=>revoke(row.id)}>撤销</button>{/if}</article>{:else}<p class="muted">{busy?'正在读取…':'尚未生成注册邀请码。'}</p>{/each}</div>
 <div class="modal-actions"><button class="button" onclick={()=>{open=false;code='';}}>关闭</button></div>
</Modal>
<style>
 .invite-entry{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.2rem;margin-bottom:1rem}.invite-entry strong{font-size:.85rem}.invite-entry p{font-size:.75rem;margin-top:.35rem}.invite-form{display:grid;grid-template-columns:minmax(0,1fr) 8rem auto;gap:.8rem;align-items:end;margin:1.2rem 0}.invite-code{border:1px solid var(--line);border-radius:.6rem;padding:1rem;margin-bottom:1rem;background:var(--background)}.invite-code p{font-size:.75rem;color:var(--muted);margin-bottom:.7rem}.invite-code>div{display:flex;align-items:center;justify-content:space-between;gap:.8rem}.invite-code code{overflow-wrap:anywhere;font-size:.8rem}.invite-list{max-height:23rem;overflow:auto}.invite-list article{display:flex;align-items:center;justify-content:space-between;gap:.8rem;padding:.85rem 0;border-bottom:1px solid var(--line)}.invite-list strong{font-size:.8rem}.invite-list p{font-size:.72rem;color:var(--muted);margin-top:.3rem}@media(max-width:600px){.invite-entry,.invite-code>div{align-items:stretch;flex-direction:column}.invite-form{grid-template-columns:1fr}.invite-list article{align-items:start}}
</style>
