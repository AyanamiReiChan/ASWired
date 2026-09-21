<script lang="ts">
 import {onMount} from 'svelte';
 import Icon from './Icon.svelte';
 import '../glass-theme.css';
 let glass=$state(true);
 let hidden=$state(false);
 let wallpaperClock=$state('');
 let video=$state<HTMLVideoElement>();
 function backgroundPortal(node:HTMLDivElement){
  // Keep the conditional block's root in place so Svelte can remove its
  // sibling controls when the theme changes. Only portal its child layer.
  const layer=node.firstElementChild!;
  document.body.appendChild(layer);
  return {destroy(){layer.remove();}};
 }
 $effect(()=>{
  if(!video)return;
  if(hidden)video.pause();
  else void video.play().catch(()=>{});
 });
 function apply(enabled:boolean){
  glass=enabled;
  if(enabled)document.documentElement.dataset.theme='glass';else delete document.documentElement.dataset.theme;
  try{localStorage.setItem('aswired-theme',enabled?'glass':'original');}catch{}
 }
 onMount(()=>{
  const updateClock=()=>{const now=new Date();wallpaperClock=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;};
  updateClock();
  const clockTimer=window.setInterval(updateClock,1000);
  const updateVisibility=()=>{hidden=document.hidden;};
  updateVisibility();
  document.addEventListener('visibilitychange',updateVisibility);
  const requested=new URL(location.href).searchParams.get('theme');
  let saved='';try{saved=localStorage.getItem('aswired-theme')??'';}catch{}
  apply(requested==='glass'||requested!=='original'&&saved!=='original');
  return ()=>{
   window.clearInterval(clockTimer);
   document.removeEventListener('visibilitychange',updateVisibility);
  };
 });
</script>
{#if glass}
 <div hidden use:backgroundPortal>
 <div class="anime-backdrop" aria-hidden="true">
  <div class="wallpaper-frame">
   <video bind:this={video} src="/themes/djgun-spacecube.mp4" poster="/themes/djgun-spacecube.jpg" autoplay muted loop playsinline preload="metadata" tabindex="-1"></video>
   <span class="wallpaper-clock">{wallpaperClock}</span>
  </div>
 </div>
 </div>
{/if}
<button class="theme-preview-switch" aria-label={glass?'切换回原主题':'切换到毛玻璃主题'} aria-pressed={glass} onclick={()=>apply(!glass)} title={glass?'毛玻璃，点击返回原主题':'切换到毛玻璃主题'}><Icon name={glass?'moon':'layers'} size={14}/><span>毛玻璃</span></button>
<style>.theme-preview-switch{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;min-height:1.8rem;padding:.25rem .65rem;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:var(--nested);font-size:.68rem;white-space:nowrap}.theme-preview-switch:hover{color:var(--foreground);border-color:var(--border)}@media(max-width:600px){.theme-preview-switch span{display:none}.theme-preview-switch{padding:.3rem;min-width:1.8rem}}</style>
