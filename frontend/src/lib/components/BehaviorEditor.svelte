<script lang="ts">
 import AppSelect from "./Select.svelte";
 import {behaviorPresetOptions,createBehaviorPreset,matchingBehaviorPreset,parseBehaviorDraft,sustainedRuleSummary} from '../behavior-presets';
 let {value=$bindable(''),inherit=true}=$props<{value?:string;inherit?:boolean}>();
 let selectedPreset=$state('balanced');
 const preview=$derived(createBehaviorPreset(selectedPreset));
 const parsed=$derived(parseBehaviorDraft(value));
 const mode=$derived(parsed.config===null?'inherit':parsed.config.enabled===false?'disabled':'enabled');
 const rules=$derived(Array.isArray(parsed.config?.rules)?parsed.config.rules:[]);
 const currentPreset=$derived(matchingBehaviorPreset(parsed.config));
 function write(config:any){value=config===null?'':JSON.stringify(config,null,2);}
 function switchMode(next:string){if(next==='inherit')write(null);else write({...parsed.config,enabled:next==='enabled',maxGapSeconds:parsed.config?.maxGapSeconds??15,rules});}
 function patch(index:number,key:string,v:unknown){write({...parsed.config,rules:rules.map((rule:any,i:number)=>i===index?{...rule,[key]:v}:rule)});}
 function applyPreset(){write(createBehaviorPreset(selectedPreset));}
 function add(){const rule=createBehaviorPreset().rules[1];write({...parsed.config,enabled:true,maxGapSeconds:parsed.config?.maxGapSeconds??15,rules:[...rules,{...rule,id:'rule-'+crypto.randomUUID().slice(0,8)}]});}
</script>
<section class="full space-top"><h3>行为限速</h3><p class="hint">按连续有效的下载采样判断。成员规则覆盖套餐，套餐覆盖全局；数值较小的优先级先执行。</p>
 <label class="field">规则策略<AppSelect aria-label="规则策略" value={mode} onchange={switchMode} disabled={!!parsed.error} options={[{value:'inherit',label:inherit?'继承上层规则':'使用内置均衡规则'},{value:'disabled',label:'明确关闭'},{value:'enabled',label:'自定义规则'}]}/></label>
 {#if !parsed.error&&mode==='inherit'}<p class="hint space-top">{inherit?'继承套餐或全局规则，不写入单独的限速配置。':'全局未配置时使用内置均衡规则；短时高速不会触发，持续下载达到阈值后限速，处罚到期自动解除。'}</p>{#if !inherit}<ul class="preset-rules">{#each createBehaviorPreset().rules as rule}<li>{sustainedRuleSummary(rule)}</li>{/each}</ul>{/if}{:else if !parsed.error&&mode==='disabled'}<p class="hint space-top">已明确关闭本层行为限速，不再继承上层规则。套餐固定速度等其他限制仍然有效。</p>{:else if currentPreset}<p class="hint space-top">当前编辑规则：{behaviorPresetOptions.find(option=>option.value===currentPreset)?.label}</p>{/if}
 <div class="preset-panel space-top"><label class="field">限速预设<AppSelect aria-label="限速预设" bind:value={selectedPreset} options={behaviorPresetOptions}/></label><ul class="preset-rules">{#each preview.rules as rule}<li>{sustainedRuleSummary(rule)}</li>{/each}</ul><p class="hint">只对持续超速触发，允许短时高速。采样间隔超过 15 秒后重新计时；处罚到期自动解除，默认不发送通知。</p><button type="button" class="button" disabled={!!parsed.error} onclick={applyPreset}>应用预设并替换当前规则</button><p class="hint">选择预设仅预览。点击应用会替换本编辑器中的规则，再保存才会生效；其他套餐和成员的明确配置保持不变。</p></div>
 {#if mode==='enabled'}<label class="field space-top">最大采样间隔 / 秒<input type="number" min="1" max="300" value={parsed.config?.maxGapSeconds??15} onchange={e=>write({...parsed.config,maxGapSeconds:e.currentTarget.valueAsNumber})}/></label>
  {#each rules as rule,index}<div class="card padded space-top"><div class="form-grid">
   <label class="field">规则标识<input value={rule.id} maxlength="100" onchange={e=>patch(index,'id',e.currentTarget.value)}/></label>
   <label class="field">触发方式<AppSelect aria-label="触发方式" value={rule.type} onchange={value=>patch(index,'type',value)} options={[{value:'sustained',label:'持续超速'},{value:'burst',label:'窗口内多次超速'}]}/></label>
   <label class="field">超速阈值 / Mbps<input type="number" min="0.001" step="any" value={rule.thresholdMbps} onchange={e=>patch(index,'thresholdMbps',e.currentTarget.valueAsNumber)}/></label>
   {#if rule.type==='sustained'}<label class="field">连续时间 / 秒<input type="number" min="1" value={rule.durationSeconds} onchange={e=>patch(index,'durationSeconds',e.currentTarget.valueAsNumber)}/></label>{:else}<label class="field">统计窗口 / 秒<input type="number" min="1" value={rule.windowSeconds} onchange={e=>patch(index,'windowSeconds',e.currentTarget.valueAsNumber)}/></label><label class="field">超速采样次数<input type="number" min="1" step="1" value={rule.hits} onchange={e=>patch(index,'hits',e.currentTarget.valueAsNumber)}/><small class="hint">每次有效采样计一次，并非独立下载次数。</small></label>{/if}
   <label class="field">处罚下载速度 / Mbps<input type="number" min="0.001" step="any" value={rule.limitMbps} onchange={e=>patch(index,'limitMbps',e.currentTarget.valueAsNumber)}/></label>
   <label class="field">处罚持续 / 秒<input type="number" min="1" value={rule.penaltySeconds} onchange={e=>patch(index,'penaltySeconds',e.currentTarget.valueAsNumber)}/></label>
   <label class="field">优先级<input type="number" step="1" value={rule.priority??0} onchange={e=>patch(index,'priority',e.currentTarget.valueAsNumber)}/></label><label class="tag"><input type="checkbox" checked={rule.notify??false} onchange={e=>patch(index,'notify',e.currentTarget.checked)}/>触发时通知</label>
  </div><button type="button" class="button small space-top" onclick={()=>write({...parsed.config,rules:rules.filter((_:any,i:number)=>i!==index)})}>删除规则</button></div>{/each}
  <button type="button" class="button space-top" disabled={rules.length>=32} onclick={add}>添加行为规则</button>
 {/if}
 {#if parsed.error}<p class="error" role="alert">{parsed.error}</p>{/if}
 <details class="space-top"><summary>高级 JSON</summary><textarea class="code-editor space-top" aria-label="行为限速 JSON" spellcheck="false" bind:value></textarea></details>
</section>
<style>
 .preset-panel{border:1px solid var(--border);border-radius:12px;padding:16px;min-width:0}
 .preset-panel .button{white-space:normal;text-align:left}
 .preset-rules{padding-left:20px;font-size:13px;line-height:1.7;overflow-wrap:anywhere}
 .preset-rules li+li{margin-top:6px}
</style>
