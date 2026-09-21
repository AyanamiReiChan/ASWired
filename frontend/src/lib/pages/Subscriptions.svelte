<script lang="ts">
 import {demo} from '../store.svelte';
 import GeneratedSubscriptions from './GeneratedSubscriptions.svelte';
 import PackageSubscriptions from './PackageSubscriptions.svelte';
</script>
{#if demo.user?.role==='admin'}
 <GeneratedSubscriptions/>
 <details class="card padded space-top"><summary>套餐实例与成员订阅</summary><div class="space-top"><PackageSubscriptions/></div></details>
{:else}
 <PackageSubscriptions/>
{/if}
<style>summary{cursor:pointer;font-weight:600}</style>
