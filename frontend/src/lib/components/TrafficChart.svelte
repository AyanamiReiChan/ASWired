<script lang="ts">
 import {demo} from '../store.svelte';
 import {buildMinuteTraffic,formatTrafficBytes,formatTrafficTime} from '../traffic-chart';
 let {compact=false,period='1小时'}=$props<{compact?:boolean;period?:string}>();
 const chart=$derived(buildMinuteTraffic(demo.data.trafficMinutes??[],period==='24小时'?'24h':period==='6小时'?'6h':'1h',demo.minuteTrafficTo,demo.minuteTrafficFrom));
 const points=$derived(chart.samples.map(sample=>({...sample,x:sample.x*7.2,y:240-sample.bytes/chart.scale.maximum*210})));
 const paths=$derived(chart.segments.map(segment=>segment.map((sample,i)=>`${i===0?'M':'L'} ${sample.x*7.2} ${240-sample.bytes/chart.scale.maximum*210}`).join(' ')));
</script>

{#if points.length}
 <div class:compact class="traffic-chart">
  <div class="chart-axis">{#each chart.scale.labels as label}<span>{label}</span>{/each}</div>
  <svg viewBox="0 0 720 260" preserveAspectRatio="none" role="img" aria-label={`最近${period}每分钟流量折线图，按北京时间连接实际记录`}>
   <g stroke="var(--line)" stroke-dasharray="3 5"><path d="M0 30H720 M0 100H720 M0 170H720 M0 240H720"/></g>
   {#each paths as path}
    <path d={path} fill="none" stroke="var(--primary)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
   {/each}
   {#each points as point}
    <circle class="traffic-point" class:single={points.length===1} cx={point.x} cy={point.y} r="4" fill="var(--primary)"><title>{formatTrafficTime(point.at,true)} · {formatTrafficBytes(point.bytes)}{point.gap?' · 存在采集缺口':''}</title></circle>
   {/each}
  </svg>
  <div class="chart-labels">{#each chart.ticks as tick,i}<span style={`left:${tick.x}%;transform:translateX(${i===0?'0':i===chart.ticks.length-1?'-100':'-50'}%)`}>{tick.label}</span>{/each}</div>
 </div>
 <p class="muted small traffic-note">每分钟上传与下载合计 · 北京时间{demo.minuteTrafficIncomplete?' · 部分记录存在采集缺口':''}</p>
{:else}
 <div class="empty traffic-empty" role="status">
  {#if demo.minuteTrafficError}<p>分钟流量暂时无法加载</p><small class="muted">稍后会自动重试。</small>
  {:else if !demo.minuteTrafficLoaded}<p>正在加载分钟流量记录…</p>
  {:else}<p>最近{period}暂无流量记录</p><small class="muted">收到实际流量上报后显示。</small>{/if}
 </div>
{/if}
{#if points.length && demo.minuteTrafficError}<p class="muted small traffic-refresh-error" role="status">分钟流量更新失败，正在显示上次记录。</p>{/if}

<style>
 .traffic-chart{padding-left:4.4rem}
 .traffic-chart svg{overflow:visible}
 .traffic-point{opacity:0;pointer-events:all}
 .traffic-point:hover,.traffic-point.single{opacity:1}
 .chart-axis{font-variant-numeric:tabular-nums}
 .chart-labels{position:relative;display:block;height:1rem}
 .chart-labels span{position:absolute;white-space:nowrap}
 .traffic-note{margin:.5rem 0}
 .traffic-empty{min-height:15rem;display:flex;flex-direction:column;justify-content:center;gap:.7rem}
 .traffic-refresh-error{margin:.5rem 0}
</style>
