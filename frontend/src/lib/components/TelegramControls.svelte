<script lang="ts">
 import ExpandableValue from './ExpandableValue.svelte';
 import {runAction,errorMessage} from '../store.svelte';let {saveConfig}=$props<{saveConfig:()=>Promise<unknown>}>();let busy=$state(false),error=$state(''),result=$state<any>(null),operation=$state('');
 const controls=[['telegram.webhook.status','读取 Webhook 状态'],['telegram.webhook.set','保存并设置 Webhook'],['telegram.webhook.delete','删除 Webhook'],['telegram.commands.set','保存并更新命令菜单']];
 async function control(action:string,label:string){if(busy)return;busy=true;error='';result=null;operation=label;try{if(action==='telegram.webhook.set'||action==='telegram.commands.set')await saveConfig();result=await runAction(action);}catch(cause){error=errorMessage(cause);}finally{busy=false;}}
</script>
<section class="space-top"><h3>Telegram 机器人管理</h3><p class="hint">Webhook 使用主控配置的公开 HTTPS 地址。设置时由主控生成或使用已保存的验证密钥；删除保留 Telegram 尚未处理的消息。状态读取使用主控当前保存的 Bot Token。</p><div class="actions space-top">{#each controls as [action,label]}<button class="button" disabled={busy} onclick={()=>control(action,label)}>{label}</button>{/each}</div>{#if error}<p class="error" role="alert">{error}</p>{/if}{#if result}<h4 class="space-top">{operation} · 实际响应</h4>{#key result}<ExpandableValue value={result} label="响应详情" force />{/key}{/if}</section>
