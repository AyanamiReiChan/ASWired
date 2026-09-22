import type { Row } from './data';
import {createSnapshotCache} from './snapshot-cache';
import {enterProbe,type ProbeLogin} from './unified-login';
export type User = { id: string; username: string; role: 'admin' | 'user' };
const collections = ['servers','inbounds','outbounds','nodes','sources','subscriptions','plans','carpools','members','billing','certificates','dnsProviders','tasks','notifications','audit','settings','policies','extensions','forwards','relays','traffic','trafficMinutes','trafficServers','trafficMembers','tokens'];
const emptyData = (): Record<string, Row[]> => Object.fromEntries(collections.map(key => [key, []]));

export const demo = $state({ data: emptyData(), loaded: false, role: '成员', toast: '', sidebar: true, revision: 0, user: null as User | null, initialized: true, connecting: true, connectionError: '', settings: {} as Record<string, any>, capabilities: {} as Record<string, any>, version: '', mode: 'live', hiddenEntry:false, trafficLoaded: false, trafficIncomplete: true, trafficError: '', minuteTrafficLoaded: false, minuteTrafficIncomplete: true, minuteTrafficError: '', minuteTrafficFrom: null as number | null, minuteTrafficTo: null as number | null });
let token = '';
let toastTimer: ReturnType<typeof setTimeout>;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
let pendingRefresh: Promise<void> | null = null;
const snapshots=createSnapshotCache(api);
let pagePath='', legacyState=false;
let summaryAt=0, minutesAt=0;
export const workspace=$state({pendingTasks:0});
export function cachedAPI(path:string,init:RequestInit={}){return snapshots.read(path,init);}
export async function trafficAPI(path:string,init:RequestInit={}){
 const value=await cachedAPI(path+'&sync=1',init);
 for(const key of ['series','servers','members'])if(value[key]&&!Array.isArray(value[key]))value[key]=Object.values(value[key]);
 if(Array.isArray(value.series))value.series.sort((a:Row,b:Row)=>Number(a.at??0)-Number(b.at??0));
 return value;
}
export function setWorkspacePage(path:string){
 if(pagePath===path)return;pagePath=path;
 if(demo.loaded&&demo.user)void refreshPageData().catch(()=>{});
}
const TOKEN_KEY = 'aswired-session';
export class APIError extends Error { constructor(message: string, public status: number, public code = '') { super(message); } }
export function toast(message: string) { demo.toast = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => demo.toast = '', 5000); }
export function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : '操作失败，请重试'; }
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const requestToken = token;
  const headers = new Headers(init.headers);
  if (requestToken) headers.set('MM-Authorization', requestToken);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let response: Response;
  try { response = await fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' }); }
  catch { throw new APIError('无法连接主控，请检查主控是否正在运行', 0, 'connection_failed'); }
  const text = await response.text();
  let body: any;
  try { body = text ? JSON.parse(text) : {}; } catch { throw new APIError('主控返回了无法读取的响应', response.status); }
  if (!response.ok) {
    if (response.status === 401 && requestToken && token === requestToken && !['invalid_totp','totp_required','invalid_credentials'].includes(body.error?.code)) { clearSession(); demo.connectionError = '登录已过期，请重新登录'; }
    throw new APIError(body.error?.message ?? `请求失败（${response.status}）`, response.status, body.error?.code);
  }
  return body as T;
}
export async function downloadAuthenticated(path: string, name: string) {
 const url=new URL(path,window.location.origin);if(url.origin!==window.location.origin)throw new APIError('下载地址必须属于当前主控',400);
 const response=await fetch(url.pathname+url.search,{headers:token?{'MM-Authorization':token}:{},cache:'no-store'});
 if(!response.ok){const error=await response.json().catch(()=>({}));throw new APIError(error.error?.message??'下载失败',response.status);}
 const objectURL=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=objectURL;link.download=name;link.click();URL.revokeObjectURL(objectURL);
}
export function returnToLogin(message=''){clearSession();demo.connectionError=message;}
export async function apiText(path: string): Promise<string> {
  const requestToken = token;
  const response = await fetch(path, { headers: requestToken ? { 'MM-Authorization': requestToken } : {}, cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) { const body = await response.json().catch(() => ({})); if (response.status === 401 && requestToken && token === requestToken) clearSession(); throw new APIError(body.error?.message ?? `请求失败（${response.status}）`, response.status); }
  return response.text();
}
function clearSession() {
  snapshots.clear();legacyState=false;summaryAt=0;minutesAt=0;workspace.pendingTasks=0;
  generation++; token = ''; demo.user = null; demo.role = '成员'; demo.data = emptyData(); demo.settings = {}; demo.capabilities = {}; demo.loaded = false; demo.trafficLoaded=false; demo.trafficIncomplete=true; demo.trafficError='';
  resetMinuteTraffic();
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(TOKEN_KEY);
  if (refreshTimer) clearTimeout(refreshTimer);
  pendingRefresh = null;
}
function resetMinuteTraffic() {
  demo.data.trafficMinutes = []; demo.minuteTrafficLoaded = false; demo.minuteTrafficIncomplete = true; demo.minuteTrafficError = ''; demo.minuteTrafficFrom = null; demo.minuteTrafficTo = null;
}
export async function initialize() {
  const started=generation;
  demo.connecting = true; demo.connectionError = ''; demo.hiddenEntry=false;token=sessionStorage.getItem(TOKEN_KEY)??'';
  try {
    const status = await api<{ initialized: boolean; version: string; capabilities: Record<string, any> }>('/api/status');
    if(generation!==started)return;
    demo.initialized = status.initialized; demo.version = status.version; demo.capabilities = status.capabilities ?? {};
    token = sessionStorage.getItem(TOKEN_KEY) ?? '';
    if (token && status.initialized) { await refreshState(); scheduleRefresh(); }
  } catch (cause) { if(generation!==started)return;if(cause instanceof APIError&&cause.status===404){clearSession();demo.hiddenEntry=true;}else demo.connectionError = errorMessage(cause); }
  finally { if(generation===started||!token)demo.connecting = false; }
}
export async function authenticate(username: string, password: string, setup = false, options: {code?: string; setupToken?: string;turnstileToken?:string} = {}) {
  const response = await api<{ token: string; user: User } | ProbeLogin>(setup ? '/api/setup' : '/api/login', { method: 'POST', body: JSON.stringify({ username, password, ...options }) });
  await acceptSession(response);
}
export async function openKomari(signal?:AbortSignal) {
  if(demo.user?.role!=='admin')throw new APIError('只有 ASWired 管理员可以管理 Komari',403);
  const started=generation;
  const response=await api<ProbeLogin>('/api/komari/login',{method:'POST',signal});
  if(generation!==started||signal?.aborted)return;
  enterProbe(response);
}
export async function acceptSession(response: {token: string; user: User}|ProbeLogin) {
  if('kind' in response&&response.kind==='komari'){clearSession();enterProbe(response);return;}
  if(!('token' in response)||!response.token||!response.user)throw new APIError('无效的登录响应',502);
  clearSession(); token = response.token; sessionStorage.setItem(TOKEN_KEY, token); demo.initialized = true; demo.connecting=false;demo.hiddenEntry=false;
  const started = generation;
  try { await refreshState(); if (generation !== started) return; demo.connectionError = ''; scheduleRefresh(); }
  catch (cause) { if (generation === started) clearSession(); throw cause; }
}
export async function logout() {
  let warning = '';
  try { await api('/api/logout', { method: 'POST' }); }
  catch (cause) { warning = '已退出本机，但主控未确认撤销登录：' + errorMessage(cause); }
  finally { clearSession(); await initialize(); if(warning&&!demo.hiddenEntry)demo.connectionError = warning; }
}
export function refreshState(afterPending = false, background = false): Promise<void> {
  if (pendingRefresh) {
    const started = generation;
    return afterPending ? pendingRefresh.catch(() => {}).then(() => generation === started ? refreshState(false,background) : undefined) : pendingRefresh;
  }
  const currentGeneration = generation;
  const request = (async () => {
    let state:any;
    try{state=legacyState?await api('/api/state'):await cachedAPI('/api/state/sync');}
    catch(cause){if(generation!==currentGeneration&&!(cause instanceof APIError))return;if(!(cause instanceof APIError)||cause.status!==404)throw cause;if(generation!==currentGeneration)return;legacyState=true;state=await api('/api/state');}
    if (generation !== currentGeneration || !token) return;
    if(state.order){for(const [key,order] of Object.entries(state.order)){state.data[key]=(order as string[]).map(id=>state.data[key][id]).filter(Boolean);}}
    const sameIdentity = demo.user?.id === state.user.id && demo.user?.role === state.user.role;
    if(demo.user&&!sameIdentity){snapshots.clear();summaryAt=0;minutesAt=0;}
    const trafficData = sameIdentity
      ? { traffic: demo.data.traffic, trafficMinutes: demo.data.trafficMinutes, trafficServers: demo.data.trafficServers, trafficMembers: demo.data.trafficMembers }
      : { traffic: [], trafficMinutes: [], trafficServers: [], trafficMembers: [] };
    if (!sameIdentity) { demo.trafficLoaded = false; demo.trafficIncomplete = true; demo.trafficError = ''; resetMinuteTraffic(); }
    const tasks=sameIdentity?demo.data.tasks:[];
    demo.data = { ...emptyData(), tasks, ...state.data, ...trafficData }; demo.user = state.user; demo.role = state.user.role === 'admin' ? '管理员' : '成员';
    workspace.pendingTasks=state.pendingTasks??demo.data.tasks.filter(row=>['待下发','执行中','待处理'].includes(row.status)).length;
    demo.settings = state.settings ?? {}; demo.capabilities = state.capabilities ?? {}; demo.loaded = true; demo.revision++; demo.connectionError = '';
    if (state.user.role !== 'admin') {
      workspace.pendingTasks=0;
      demo.data.nodes = demo.data.nodes.filter(row => row.subscriptionAuthorized === true);
      for (const collection of ['sources','tasks','audit','certificates','notifications','extensions','traffic','trafficServers','trafficMembers']) demo.data[collection] = [];
      demo.trafficLoaded = false; demo.trafficIncomplete = true; demo.trafficError = ''; resetMinuteTraffic();
      return;
    }
    await refreshPageData(!background);
  })();
  pendingRefresh = request;
  void request.finally(() => { if (pendingRefresh === request) pendingRefresh = null; }).catch(() => {});
  return request;
}
export async function refreshPageData(force=false){
    if(!token||demo.user?.role!=='admin'||(typeof document!=='undefined'&&document.hidden))return;
    const currentGeneration=generation;
    const summary = async () => { try {
      const traffic = await trafficAPI('/api/traffic?range=30d');
      if (generation !== currentGeneration || !token) return;
      if(demo.user?.role!=='admin')return;
      demo.data.traffic = traffic.series ?? []; demo.data.trafficServers = traffic.servers ?? []; demo.data.trafficMembers = traffic.members ?? [];
      demo.trafficLoaded = true; demo.trafficIncomplete = traffic.incomplete === true; demo.trafficError = '';
      summaryAt=Date.now();
    } catch (cause) {
      if (generation !== currentGeneration || !token || demo.user?.role!=='admin') return;
      if (cause instanceof APIError && cause.status === 403) {
        demo.data.traffic = []; demo.data.trafficServers = []; demo.data.trafficMembers = []; demo.trafficLoaded = false;
      }
      demo.trafficIncomplete = true; demo.trafficError = errorMessage(cause);
    } };
    const minutes = async () => { try {
      const traffic = await trafficAPI('/api/traffic?range=24h&interval=1m');
      if (generation !== currentGeneration || !token) return;
      if(demo.user?.role!=='admin')return;
      if (traffic.interval !== '1m' || traffic.bucketSeconds !== 60 || !Array.isArray(traffic.series) || !Number.isFinite(traffic.from) || !Number.isFinite(traffic.to) || traffic.to <= traffic.from) throw new APIError('主控返回的分钟流量记录无效', 502);
      demo.data.trafficMinutes = traffic.series; demo.minuteTrafficFrom = traffic.from; demo.minuteTrafficTo = traffic.to;
      demo.minuteTrafficLoaded = true; demo.minuteTrafficIncomplete = traffic.incomplete === true; demo.minuteTrafficError = '';
      minutesAt=Date.now();
    } catch (cause) {
      if (generation !== currentGeneration || !token || demo.user?.role!=='admin') return;
      if (cause instanceof APIError && cause.status === 403) resetMinuteTraffic();
      demo.minuteTrafficIncomplete = true; demo.minuteTrafficError = errorMessage(cause);
    } };
    const jobs:Promise<void>[]=[];
    if(['/', '/traffic'].includes(pagePath)&&(force||Date.now()-summaryAt>=60000))jobs.push(summary());
    if(pagePath==='/traffic'&&(force||Date.now()-minutesAt>=30000))jobs.push(minutes());
    if(['/tasks','/certificates'].includes(pagePath)&&!legacyState)jobs.push((async()=>{
      try{const value=await cachedAPI('/api/operations/tasks?limit=200');
       if(generation!==currentGeneration||demo.user?.role!=='admin')return;
       demo.data.tasks=value.order.map((id:string)=>value.rows[id]);
      }catch(cause){if(generation===currentGeneration&&demo.user?.role==='admin')demo.connectionError=errorMessage(cause);}
    })());
    await Promise.all(jobs);
}
function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    if (!token || !demo.user) return;
    if (!document.hidden) { try { await refreshState(false,true); } catch (cause) { demo.connectionError = errorMessage(cause); } }
    if (token && demo.user) scheduleRefresh();
  }, 5000);
}
export function stopRefresh() { if (refreshTimer) clearTimeout(refreshTimer); }
export async function getRow(collection: string, id: string): Promise<Row> { return (await api<{ row: Row }>(`/api/collections/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`)).row; }
export async function saveRow(collection: string, row: Row): Promise<Row> {
  const started = generation;
  const exists = demo.data[collection]?.some(item => item.id === row.id);
  const result = await api<{ row: Row }>(`/api/collections/${encodeURIComponent(collection)}${exists ? '/' + encodeURIComponent(row.id) : ''}`, { method: exists ? 'PUT' : 'POST', body: JSON.stringify({ row }) });

  if (generation === started) { try { await refreshState(true); } catch { toast('已保存，但列表刷新失败，请刷新页面'); } }
  return result.row;
}
export async function removeRow(collection: string, id: string) {
  const started = generation;
  await api(`/api/collections/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (generation !== started) return;
  demo.data[collection] = (demo.data[collection] ?? []).filter(row => row.id !== id); demo.revision++;
  try{await refreshState(true);}catch{toast('已删除，但列表刷新失败，请刷新页面');}
}
export async function saveSettings(settings: Record<string, any>) {
  const started = generation;
  const result = await api<{ settings: Record<string, any> }>('/api/settings', { method: 'PUT', body: JSON.stringify({ settings }) });
  if (generation === started) {demo.settings = result.settings;try{await refreshState(true);}catch{toast('已保存设置，状态稍后重试更新');}} return result.settings;
}
export async function runAction(action: string, targetId?: string, collection?: string, params?: Record<string, any>) {
  const started = generation;
  const result = await api('/api/actions', { method: 'POST', body: JSON.stringify({ action, targetId, collection, params }) });
  if (generation === started) { try { await refreshState(true); } catch { toast('请求已受理，但状态刷新失败，请刷新页面'); } }
  return result;
}
export async function simulateJob(action: string, target: string) {
  try { const result = await runAction(action, undefined, undefined, { target }); toast(result.task ? '请求已受理，请查看执行状态' : result.message ?? '操作完成'); }
  catch (cause) { toast(errorMessage(cause)); }
}
export function loadDemo() { return initialize(); }
export function persist() {   }
export function audit() {   }
export function resetDemo() { toast('真实工作区不能恢复演示数据'); }
export function download(name: string, body: string, type = 'text/plain') { const url = URL.createObjectURL(new Blob([body], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
export async function copy(text: string) { try { await navigator.clipboard.writeText(text); toast('已复制'); } catch { toast('浏览器未允许剪贴板，请手动复制'); } }
export const money = (value: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value || 0);
export const percent = (used: number, total: number) => total ? Math.min(100, Math.round((used || 0) / total * 100)) : 0;
