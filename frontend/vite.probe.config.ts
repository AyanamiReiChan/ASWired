import {defineConfig} from 'vite';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import {resolve} from 'node:path';
import {mkdirSync,copyFileSync} from 'node:fs';
export default defineConfig({plugins:[tailwindcss(),svelte({configFile:false}),{name:'probe-fonts',writeBundle(){const directory=resolve('worker/public/fonts');mkdirSync(directory,{recursive:true});for(const font of ['inter.woff2','lora.woff2','Inter-OFL.txt','Lora-OFL.txt'])copyFileSync(resolve('static/fonts',font),resolve(directory,font));}}],publicDir:false,build:{outDir:'worker/public',emptyOutDir:true,rollupOptions:{input:resolve('probe/index.html')}}});
