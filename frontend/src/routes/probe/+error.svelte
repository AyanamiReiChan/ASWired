<script lang="ts">
 import {page} from '$app/state';
</script>

<svelte:head><title>无法打开探针 · ASWired</title></svelte:head>
<main class="probe-error">
 <section class="card padded stack">
  <h1>无法打开 Komari 探针</h1>
  <p role="alert">{page.error?.message || '请稍后重试。'}</p>
  <div class="actions"><a class="button primary" href="/probe" data-sveltekit-reload>重试</a><a class="button" href="/">返回工作区</a></div>
 </section>
</main>

<style>.probe-error{max-width:640px;margin:10vh auto;padding:1.5rem}</style>
