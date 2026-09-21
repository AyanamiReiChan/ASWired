import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { localDesignDocs } from './local-docs-plugin';
const apiTarget = process.env.ASWIRED_API_TARGET || 'http://127.0.0.1:12889';
export default defineConfig({ plugins: [localDesignDocs(),tailwindcss(),sveltekit()], server: {strictPort:true, proxy: { '/.well-known/webauthn': { target: apiTarget, changeOrigin: true }, '/api': { target: apiTarget, changeOrigin: true, ws: true }, '/mcp': { target: apiTarget, changeOrigin: true } }} });
