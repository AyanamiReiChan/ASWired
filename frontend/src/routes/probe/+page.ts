import {error, redirect} from '@sveltejs/kit';
import type {PageLoad} from './$types';

export const load: PageLoad = async ({fetch}) => {
 let response: Response;
 try {
  response = await fetch('/api/public/probe-link', {cache: 'no-store'});
 } catch {
  error(503, '无法读取 Komari 探针地址，请稍后重试。');
 }
 if (!response.ok) {
  error(503, response.status === 503 ? '尚未配置 Komari 公开访问地址，请联系管理员。' : '无法读取 Komari 探针地址，请稍后重试。');
 }
 const {url} = await response.json();
 redirect(307, url);
};
