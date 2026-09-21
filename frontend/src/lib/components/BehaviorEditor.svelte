<script lang="ts">
 let {value=$bindable(''),inherit=true}=$props<{value?:string;inherit?:boolean}>();
 const parsed=$derived.by(()=>{try{const result=value.trim()?JSON.parse(value):null;return result&&(!Array.isArray(result)&&typeof result==='object')?{config:result,error:''}:result===null?{config:null,error:''}:{config:null,error:'规则必须为 JSON 对象'};}catch{return {config:null,error:'现有 JSON 无法解析，请在高级编辑中修正；原文已保留'};}});
 const mode=$derived(parsed.config===null?'inherit':parsed.config.enabled===false?'disabled':'enabled');
 const rules=$derived(Array.isArray(parsed.config?.rules)?parsed.config.rules:[]);
 function write(config:any){value=config===null?'':JSON.stringify(config,null,2);}
 function switchMode(next:string){if(next==='inherit')write(null);else write({...parsed.config,enabled:next==='enabled',maxGapSeconds:parsed.config?.maxGapSeconds??15,rules});}
 function patch(index:number,key:string,v:unknown){write({...parsed.config,rules:rules.map((rule:any,i:number)=>i===index?{...rule,[key]:v}:rule)});}
 function add(){write({...parsed.config,enabled:true,maxGapSeconds:parsed.config?.maxGapSeconds??15,rules:[...rules,{id:'rule-'+crypto.randomUUID().slice(0,8),type:'sustained',thresholdMbps:100,durationSeconds:30,windowSeconds:60,hits:3,limitMbps:20,penaltySeconds:300,priority:10,notify:false}]});}
</script>
<section class="full space-top"><h3>行为限速</h3><p class="hint">按连续有效的下载采样判断。成员规则覆盖套餐，套餐覆盖全局；数值较小的优先级先执行。</p>
 <label class="field">规则策略<select value={mode} onchange={e=>switchMode(e.currentTarget.value)} disabled={!!parsed.error}><option value="inherit">{inherit?'继承上层规则':'不设置全局规则'}</option><option value="disabled">明确关闭</option><option value="enabled">自定义规则</option></select></label>
 {#if mode==='enabled'}<label class="field space-top">最大采样间隔 / 秒<input type="number" min="1" max="300" value={parsed.config.maxGapSeconds??15} onchange={e=>write({...parsed.config,maxGapSeconds:e.currentTarget.valueAsNumber})}/></label>
  {#each rules as rule,index}<div class="card padded space-top"><div class="form-grid">
   <label class="field">规则标识<input value={rule.id} maxlength="100" onchange={e=>patch(index,'id',e.currentTarget.value)}/></label>
   <label class="field">触发方式<select value={rule.type} onchange={e=>patch(index,'type',e.currentTarget.value)}><option value="sustained">持续超速</option><option value="burst">窗口内多次超速</option></select></label>
   <label class="field">超速阈值 / Mbps<input type="number" min="0.001" step="any" value={rule.thresholdMbps} onchange={e=>patch(index,'thresholdMbps',e.currentTarget.valueAsNumber)}/></label>
   {#if rule.type==='sustained'}<label class="field">连续时间 / 秒<input type="number" min="1" value={rule.durationSeconds} onchange={e=>patch(index,'durationSeconds',e.currentTarget.valueAsNumber)}/></label>{:else}<label class="field">统计窗口 / 秒<input type="number" min="1" value={rule.windowSeconds} onchange={e=>patch(index,'windowSeconds',e.currentTarget.valueAsNumber)}/></label><label class="field">触发次数<input type="number" min="1" step="1" value={rule.hits} onchange={e=>patch(index,'hits',e.currentTarget.valueAsNumber)}/></label>{/if}
   <label class="field">处罚下载速度 / Mbps<input type="number" min="0.001" step="any" value={rule.limitMbps} onchange={e=>patch(index,'limitMbps',e.currentTarget.valueAsNumber)}/></label>
   <label class="field">处罚持续 / 秒<input type="number" min="1" value={rule.penaltySeconds} onchange={e=>patch(index,'penaltySeconds',e.currentTarget.valueAsNumber)}/></label>
   <label class="field">优先级<input type="number" step="1" value={rule.priority??0} onchange={e=>patch(index,'priority',e.currentTarget.valueAsNumber)}/></label><label class="tag"><input type="checkbox" checked={rule.notify??false} onchange={e=>patch(index,'notify',e.currentTarget.checked)}/>触发时通知</label>
  </div><button type="button" class="button small space-top" onclick={()=>write({...parsed.config,rules:rules.filter((_:any,i:number)=>i!==index)})}>删除规则</button></div>{/each}
  <button type="button" class="button space-top" disabled={rules.length>=32} onclick={add}>添加行为规则</button>
 {/if}
 {#if parsed.error}<p class="error" role="alert">{parsed.error}</p>{/if}
 <details class="space-top"><summary>高级 JSON</summary><textarea class="code-editor space-top" aria-label="行为限速 JSON" spellcheck="false" bind:value></textarea></details>
</section>
