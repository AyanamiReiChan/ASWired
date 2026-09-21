<script lang="ts">
 import {onMount} from 'svelte';
 import AppSelect from './Select.svelte';
 import Modal from './Modal.svelte';
 import {api,errorMessage,downloadAuthenticated} from '../store.svelte';

 type Connection={host:string;port:number;database:string;username:string;password:string;sslMode:string;maxOpen:number;maxIdle:number};
 type Migration={state:string;message:string;backupId?:string;target:Omit<Connection,'password'>};
 type Status={driver:string;databaseType:string;sizeBytes:number|null;walSizeBytes:number|null;openConnections:number;inUse:number;idle:number;maxOpen:number;maxIdle?:number;canMigrate:boolean;connection?:Omit<Connection,'password'>;migration?:Migration;lastMigration?:Migration};
 let status=$state<Status|null>(null),loading=$state(false),busy=$state(false),message=$state(''),error=$state(''),confirm=$state(''),showConfirm=$state(false),restarting=$state(false);
 let form=$state<Connection>({host:'127.0.0.1',port:5432,database:'aswired',username:'aswired',password:'',sslMode:'prefer',maxOpen:30,maxIdle:10});
 let formElement:HTMLFormElement;
 const backupId=$derived(status?.migration?.backupId??status?.lastMigration?.backupId);
 function size(value:number|null|undefined){if(value==null)return '—';if(value<1024)return `${value} B`;const unit=value<1024**2?1:value<1024**3?2:3;return `${(value/1024**unit).toFixed(1)} ${['B','KiB','MiB','GiB'][unit]}`;}
 async function refresh(initial=false){if(loading)return;loading=true;error='';try{status=await api<Status>('/api/database/status');const connection=status.migration?.target??status.connection;if(initial&&connection)form={...form,...connection,password:''};restarting=status.migration?.state==='pending'||status.migration?.state==='copying';if(status.migration?.state==='failed')message='';}catch(cause){error=errorMessage(cause);}finally{loading=false;}}
 onMount(()=>{void refresh(true);});
 function valid(){if(!formElement.reportValidity())return false;if(form.maxIdle>form.maxOpen){error='最大空闲连接不能超过最大连接数';return false;}error='';return true;}
 async function testConnection(){if(busy||!valid())return;busy=true;message='';try{const result=await api<{latencyMs:number}>('/api/database/test',{method:'POST',body:JSON.stringify(form)});message=`PostgreSQL 连接成功，耗时 ${result.latencyMs} ms`;}catch(cause){error=errorMessage(cause);}finally{busy=false;}}
 function openMigration(){if(!valid()||!status?.canMigrate||restarting)return;confirm='';showConfirm=true;}
 async function migrate(){if(busy||confirm!=='迁移到 PostgreSQL')return;busy=true;error='';try{const result=await api<{message:string}>('/api/database/migrate',{method:'POST',body:JSON.stringify({confirm,target:form})});message=result.message;form.password='';showConfirm=false;confirm='';restarting=true;}catch(cause){error=errorMessage(cause);}finally{busy=false;}}
 async function downloadBackup(id:string){try{await downloadAuthenticated(`/api/backups/${encodeURIComponent(id)}`,`aswired-before-migration-${id}.zip`);}catch(cause){error=errorMessage(cause);}}
</script>

<p class="muted">查看主控数据库占用，测试 PostgreSQL，并将 SQLite 数据迁移后自动重启切换。</p>
<div class="database-summary" aria-busy={loading}>
 <div><span>当前类型</span><strong>{status?.databaseType??(loading?'读取中…':'—')}</strong></div>
 <div><span>数据库大小</span><strong>{size(status?.sizeBytes)}</strong></div>
 <div><span>WAL</span><strong>{status?.driver==='postgres'?'由 PostgreSQL 管理':size(status?.walSizeBytes)}</strong></div>
 <div><span>连接池</span><strong>{status?`${status.inUse} 使用中 / ${status.openConnections} 已打开`:'—'}</strong>{#if status}<small>{status.idle} 空闲 / 上限 {status.maxOpen}</small>{/if}</div>
</div>
<div class="actions"><button class="button" disabled={loading||busy} onclick={()=>refresh()}>{loading?'读取中…':'刷新状态'}</button></div>
{#if error}<p class="error space-top" role="alert">{error}</p>{/if}
{#if message}<p class="status-banner space-top" role="status">{message}</p>{/if}
{#if status?.migration?.state==='failed'}<p class="error space-top" role="alert">{status.migration.message}。修正配置后可重新提交迁移。</p>{/if}
{#if restarting}<p class="hint space-top">主控正在准备或执行迁移，期间页面会短暂断开。请稍后点击「刷新状态」确认结果。</p>{/if}
{#if status?.lastMigration}<p class="status-banner space-top">{status.lastMigration.message}</p>{/if}
{#if backupId}<button class="button space-top" onclick={()=>downloadBackup(backupId)}>下载迁移前备份</button>{/if}

<form bind:this={formElement} class="space-top" onsubmit={event=>{event.preventDefault();void testConnection();}}>
 <fieldset disabled={busy||restarting}>
  <div class="database-form">
   <label class="field">主机<input required maxlength="253" bind:value={form.host} placeholder="127.0.0.1" autocomplete="off"/></label>
   <label class="field">端口<input required type="number" min="1" max="65535" step="1" bind:value={form.port}/></label>
   <label class="field">数据库名<input required maxlength="63" bind:value={form.database} autocomplete="off"/></label>
   <label class="field">用户名<input required maxlength="63" bind:value={form.username} autocomplete="off"/></label>
   <label class="field">密码<input type="password" maxlength="4096" bind:value={form.password} placeholder="PostgreSQL 密码" autocomplete="new-password"/></label>
   <label class="field">SSL 模式<AppSelect bind:value={form.sslMode} options={['disable','prefer','require','verify-ca','verify-full']} aria-label="SSL 模式" disabled={busy||restarting}/></label>
   <label class="field">最大连接数<input required type="number" min="1" max="1000" step="1" bind:value={form.maxOpen}/></label>
   <label class="field">最大空闲连接<input required type="number" min="0" max={form.maxOpen} step="1" bind:value={form.maxIdle}/></label>
  </div>
  <div class="actions space-top"><button class="button" type="submit">{busy?'处理中…':'测试连接'}</button><button class="button primary" type="button" disabled={!status?.canMigrate} onclick={openMigration}>迁移到 PostgreSQL</button></div>
 </fieldset>
</form>
<p class="hint space-top">迁移要求目标数据库的 schema 为空。主控会暂停写入，保留 SQLite 和迁移前备份；复制并校验成功后使用新连接，失败时继续使用原数据库。连接数设置随迁移生效。</p>
<p class="hint">状态仅在进入此页或手动刷新时读取，不访问 Agent。测试连接不保存密码。</p>

<Modal bind:open={showConfirm} title="迁移到 PostgreSQL" description="主控将短暂停止服务，备份、复制并校验全部主控数据。">
 <p>目标：{form.host}:{form.port} / {form.database}</p>
 <p class="hint space-top">原 SQLite 文件保留，迁移成功后自动切换并恢复服务。连接配置加密保存在主控数据目录中。</p>
 <label class="field space-top">输入「迁移到 PostgreSQL」确认<input bind:value={confirm} autocomplete="off" disabled={busy}/></label>
 {#if error}<p class="error space-top" role="alert">{error}</p>{/if}
 <div class="actions space-top"><button class="button" disabled={busy} onclick={()=>showConfirm=false}>取消</button><button class="button primary" disabled={busy||confirm!=='迁移到 PostgreSQL'} onclick={migrate}>{busy?'正在验证目标…':'确认迁移并重启'}</button></div>
</Modal>

<style>
 .database-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;border:1px solid var(--border);border-radius:12px;padding:20px;margin:20px 0 12px;background:var(--panel-soft,transparent)}
 .database-summary span,.database-summary small{display:block;color:var(--muted);font-size:12px}.database-summary strong{display:block;margin-top:7px;font-weight:600;font-size:15px;overflow-wrap:anywhere}.database-summary small{margin-top:4px}
 .database-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.database-form input{min-width:0;width:100%}fieldset{border:0;margin:0;padding:0;min-width:0}fieldset:disabled{opacity:.65}
 @media(max-width:1100px){.database-summary,.database-form{grid-template-columns:repeat(2,minmax(0,1fr))}}
 @media(max-width:600px){.database-form{grid-template-columns:1fr}.database-summary{padding:15px;gap:18px 12px}.actions{flex-wrap:wrap}}
</style>
