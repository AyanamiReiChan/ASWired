<script lang="ts">
 import {demo} from '../store.svelte';
 import {dailyTraffic, overviewBytes} from '../overview';
 let selected = $state<number | null>(null);
 const chart = $derived(dailyTraffic(demo.data.traffic));
 const first = $derived(chart.samples[0]?.at ?? 0), last = $derived(chart.samples.at(-1)?.at ?? 0);
 const points = $derived(chart.samples.map(sample => ({...sample, x: first === last ? 500 : 12 + (sample.at-first)/(last-first)*976, y: 214-sample.bytes/chart.maximum*184})));
 const segments = $derived.by(() => {
  const result: typeof points[] = [];
  for (const point of points) {
   const previous = result.at(-1)?.at(-1);
   if (!previous || point.at-previous.at > 86400000) result.push([]);
   result.at(-1)!.push(point);
  }
  return result;
 });
 const active = $derived(points.find(point => point.at === selected) ?? points.at(-1));
 const labels = $derived(points.filter((_, i) => i === 0 || i === points.length-1 || i % Math.max(1, Math.ceil(points.length/7)) === 0));
 function inspect(event: PointerEvent) {
  const bounds = event.currentTarget instanceof Element ? event.currentTarget.getBoundingClientRect() : null;
  if (!bounds || !points.length) return;
  const x = (event.clientX-bounds.left)/bounds.width*1000;
  selected = points.reduce((closest, point) => Math.abs(point.x-x)<Math.abs(closest.x-x)?point:closest).at;
 }
 function step(event: KeyboardEvent) {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key) || !points.length) return;
  event.preventDefault();
  const index = Math.max(0, points.findIndex(point => point.at === active?.at));
  selected = points[event.key==='Home'?0:event.key==='End'?points.length-1:Math.max(0,Math.min(points.length-1,index+(event.key==='ArrowRight'?1:-1)))].at;
 }
</script>
<div class="daily-summary"><div><span class="muted small">最近 30 天 · 已记录合计</span><strong>{demo.trafficLoaded ? overviewBytes(chart.total) : '—'}</strong></div>
 {#if active}<div class="daily-inspection" aria-live="polite"><span>{active.date}</span><strong>{overviewBytes(active.bytes)}</strong><small>{active.gap?'包含采集缺口':'当日代理流量'}</small></div>{/if}
</div>
{#if points.length}
 <div class="daily-chart"><div class="daily-axis">{#each [1,.75,.5,.25,0] as fraction}<span>{overviewBytes(chart.maximum*fraction)}</span>{/each}</div>
  <div class="plot" role="slider" tabindex="0" aria-label="每日流量，使用左右方向键查看日期" aria-valuemin={0} aria-valuemax={Math.max(1,points.length-1)} aria-valuenow={Math.max(0,points.findIndex(point=>point.at===active?.at))} aria-valuetext={`${active?.date}，${overviewBytes(active?.bytes??null)}`} onkeydown={step} onpointermove={inspect}>
   <svg viewBox="0 0 1000 240" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="overview-traffic-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--primary)" stop-opacity=".32"/><stop offset="100%" stop-color="var(--primary)" stop-opacity=".015"/></linearGradient></defs>
    {#each [30,76,122,168,214] as y}<path d={`M0 ${y}H1000`} stroke="var(--line)" stroke-dasharray="3 6" vector-effect="non-scaling-stroke"/>{/each}
    {#each segments as segment}{@const path=segment.map((point,i)=>`${i?'L':'M'}${point.x},${point.y}`).join(' ')}
     {#if segment.length>1}<path d={`${path} L${segment.at(-1)!.x},214 L${segment[0].x},214 Z`} fill="url(#overview-traffic-fill)"/><path d={path} fill="none" stroke="var(--primary)" stroke-width="2.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>{/if}
    {/each}
    {#if active}<path d={`M${active.x} 22V214`} stroke="var(--primary)" opacity=".45" stroke-dasharray="4 5" vector-effect="non-scaling-stroke"/>{/if}
    {#each points as point}<circle cx={point.x} cy={point.y} r={active?.at===point.at?4.5:2.5} fill="var(--primary)" stroke="var(--card)" stroke-width="2" vector-effect="non-scaling-stroke"/>{/each}
   </svg><div class="daily-dates">{#each labels as point}<span style={`left:${point.x/10}%;transform:translateX(${point.x<30?'0':point.x>970?'-100':'-50'}%)`}>{point.date.slice(5)}</span>{/each}</div>
  </div>
 </div><div class="daily-caption"><span><i></i>上传 + 下载 · 北京时间</span><span>{points.length} 天有记录 · 未上报日期留空</span></div>
{:else}<div class="empty daily-empty"><strong>{demo.trafficError?'流量记录暂时无法加载':demo.trafficLoaded?'暂无每日流量记录':'正在加载流量记录…'}</strong><span>收到实际代理流量后，趋势会显示在这里。</span></div>{/if}
<style>
 .daily-summary{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:1.4rem 0 .25rem}.daily-summary>div:first-child{display:flex;flex-direction:column;gap:.3rem}.daily-summary>div>strong{font-size:1.8rem;font-weight:550;letter-spacing:-.04em}.daily-inspection{display:grid;grid-template-columns:auto auto;gap:.3rem 1rem;text-align:right;font-size:.8rem}.daily-inspection>strong{font-size:1rem!important;color:var(--primary)}.daily-inspection small{grid-column:1/-1;color:var(--muted);font-size:.68rem}.daily-chart{display:flex;gap:1rem;height:17rem}.daily-axis{flex-shrink:0;width:4.2rem;display:flex;flex-direction:column;justify-content:space-between;padding:2.1rem 0 1.75rem;color:var(--muted);font-size:.65rem;text-align:right}.plot{flex:1;min-width:0;position:relative;outline-offset:4px;border-radius:.3rem}.plot svg{width:100%;height:100%;overflow:visible}.daily-dates{position:absolute;bottom:.1rem;left:0;right:0;font-size:.65rem;color:var(--muted)}.daily-dates span{position:absolute;white-space:nowrap;bottom:0}.daily-caption{display:flex;justify-content:space-between;gap:.7rem;margin:1rem 0 0;color:var(--muted);font-size:.67rem}.daily-caption span:first-child{display:flex;align-items:center;gap:.45rem}.daily-caption i{width:.45rem;height:.45rem;border-radius:50%;background:var(--primary)}.daily-empty{min-height:16rem;display:flex;flex-direction:column;gap:.7rem}.daily-empty span{font-size:.8rem;color:var(--muted)}
 @media(max-width:600px){.daily-chart{height:14rem;gap:.6rem}.daily-axis{width:3.5rem;font-size:.6rem;padding-top:1.65rem;padding-bottom:1.5rem}.daily-dates span:nth-child(2n){display:none}.daily-caption{flex-wrap:wrap}.daily-summary>div>strong{font-size:1.45rem}.daily-inspection{gap:.25rem .5rem;font-size:.72rem}}
</style>
