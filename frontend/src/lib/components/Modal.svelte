<script lang="ts">
 import {Dialog} from 'bits-ui'; import type {Snippet} from 'svelte';
 let {open=$bindable(false),title,description='',wide=false,extraWide=false,children}=$props<{open?:boolean;title:string;description?:string;wide?:boolean;extraWide?:boolean;children:Snippet}>();
</script>
<Dialog.Root bind:open><Dialog.Portal><Dialog.Overlay class="modal-overlay"/><Dialog.Content class={`modal ${wide?'wide':''}`} style={extraWide?'width:min(96rem,calc(100vw - 2rem))':undefined}><div class="modal-heading"><div><Dialog.Title class="modal-title">{title}</Dialog.Title><Dialog.Description class="muted">{description}</Dialog.Description></div></div>{@render children()}</Dialog.Content></Dialog.Portal></Dialog.Root>
