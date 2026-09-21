<script lang="ts">
 const gradientId = $props.id();
</script>

<!-- Vector reconstruction of the original 100 × 90 animated brand mark. -->
<svg class="animated-logo" viewBox="0 0 100 90" fill="none" aria-hidden="true" focusable="false">
 <defs>
  <linearGradient id={gradientId} x1="50" y1="10" x2="50" y2="80" gradientUnits="userSpaceOnUse">
   <stop class="top"/>
   <stop class="bottom" offset="1"/>
  </linearGradient>
 </defs>
 <g stroke={'url(#'+gradientId+')'} stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M28 22 14 36Q11 39 14 42L28 56M72 22 86 36Q89 39 86 42L72 56"/>
  <path d="M27 72 30 75C35 80 43 79 43 71V59C43 56 41 54 38 52A18 18 0 1 1 62 52C59 54 57 56 57 59V71C57 79 65 80 70 75L73 72"/>
 </g>
 <g fill={'url(#'+gradientId+')'}>
  <path d="m47.1 32 5.8 0 4.1 4.1v5.8L52.9 46h-5.8L43 41.9v-5.8Z"/>
  <circle r="2.7">
   <animateMotion dur="4.2s" repeatCount="indefinite" path="M50 10A40 30 0 1 0 50 70A40 30 0 1 0 50 10"/>
  </circle>
  <circle r="2.7">
   <animateMotion dur="4.2s" begin="-1.4s" repeatCount="indefinite" path="M50 10A40 30 0 1 0 50 70A40 30 0 1 0 50 10"/>
  </circle>
  <circle r="2.7">
   <animateMotion dur="4.2s" begin="-2.8s" repeatCount="indefinite" path="M50 10A40 30 0 1 0 50 70A40 30 0 1 0 50 10"/>
  </circle>
 </g>
</svg>

<style>
 .animated-logo{display:block;width:100%;height:100%}
 .top,.bottom{stop-color:#cf6a8a}
 :global(html[data-theme='glass']) .top{stop-color:#aee0ff}
 :global(html[data-theme='glass']) .bottom{stop-color:#c7bcff}
</style>
