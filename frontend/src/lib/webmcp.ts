import {tick} from 'svelte';
import {goto} from '$app/navigation';
import {navigation,canAccessPage} from './navigation';
import {demo} from './store.svelte';
export function registerDemoTools(){
 const context=(document as Document&{modelContext?:{registerTool:(tool:any,options:any)=>unknown}}).modelContext;
 if(!context?.registerTool)return()=>{};
 const controller=new AbortController();
 const tools=[
  {name:'read_demo_workspace_summary',title:'读取演示工作区',description:'只读取 ASWired 本地演示的服务器、订阅、车队和账单数量，不返回凭据。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({demo:true,servers:demo.data.servers.length,subscriptions:demo.data.subscriptions.length,carpools:demo.data.carpools.length,pendingBills:demo.data.billing.filter(b=>b.status!=='已核销').length})},
  {name:'navigate_to_demo_page',title:'打开演示页面',description:'切换 ASWired 页面，不创建或修改业务数据。',inputSchema:{type:'object',properties:{path:{type:'string',enum:navigation.filter(n=>canAccessPage(demo.user?.role,n[0])).map(n=>n[0])}},required:['path'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input:unknown)=>{const path=(input as {path?:string})?.path;if(!navigation.some(n=>n[0]===path))throw new Error('未知页面路径');if(!canAccessPage(demo.user?.role,path!))throw new Error('没有访问此页面的权限');await goto(path!);await tick();return{demo:true,path};}},
  {name:'read_demo_carpool_seats',title:'查询演示车队席位',description:'按车队名称读取可用席位及演示月分摊，不预订席位或发起付款。',inputSchema:{type:'object',properties:{name:{type:'string'}},required:['name'],additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:(input:unknown)=>{const name=(input as {name?:string})?.name;const car=demo.data.carpools.find(c=>c.name===name);if(!car)throw new Error('车队不存在');return{demo:true,name:car.name,capacity:car.capacity,occupied:car.members,available:Math.max(0,car.capacity-car.members),monthlyShareCny:car.unitPrice};}}
 ];
 for(const tool of tools){try{void Promise.resolve(context.registerTool(tool,{signal:controller.signal})).catch(()=>{});}catch{}}
 return()=>controller.abort();
}
