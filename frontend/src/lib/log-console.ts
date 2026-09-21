type Row=Record<string,any>;
export type LogCategory='system'|'agent'|'schedule'|'security';
export const logLevels=['TRACE','DEBUG','INFO','WARN','ERROR','FATAL'] as const;
export type LogLevel=typeof logLevels[number];
export type LogEntry={id:string;recordId:string;collection:'audit'|'tasks';category:LogCategory;at:string;level:LogLevel;source:string;event:string;message:string;target:string;taskId:string;fields:Row;searchText:string};
const securityEvent=/^(auth\.|identity\.|login(?:\.|$)|logout(?:\.|$)|token\.|password\.|session\.|account\.|security\.|entrance\.|qr\.)/i;
const protectedField=/(password|secret|token|credential|private.?key|authorization|cookie|certificate|config|pem|uri$)/i;
export function logFields(value:any):any{
 if(Array.isArray(value))return value.map(logFields);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,protectedField.test(key)?'[已隐藏]':logFields(item)]));
 return value;
}
export function eventLevel(row:Row):LogLevel{
 const explicit=String(row.level??'').toUpperCase();
 if(logLevels.includes(explicit as LogLevel))return explicit as LogLevel;
 const status=String(row.status??row.detail?.status??row.result??'').toLowerCase();
 if(['failed','失败','error'].includes(status)||row.error)return 'ERROR';
 if(['unknown','unsupported','结果未明','不支持','已撤回','superseded'].includes(status))return 'WARN';
 if(/(?:failed|denied|rejected)(?:\.|$)/i.test(row.action??''))return 'WARN';
 return 'INFO';
}
const messages:Record<string,string>={'agent.command.queued':'已提交 Agent 指令','record.save':'保存记录','record.delete':'删除记录','settings.save':'更新系统设置','schedule.run':'定时任务执行','auth.login':'账户登录','auth.logout':'账户退出','login':'账户登录','logout':'账户退出','log.delete':'删除日志记录','server.enrollment.read':'读取服务器接入配置'};
export function consoleEntries(data:Record<string,Row[]>):LogEntry[]{
 const audits=data.audit??[],tasks=data.tasks??[],scheduleIds=new Set<string>();
 for(const event of audits)if(event.action==='schedule.run'&&event.detail?.taskId)scheduleIds.add(String(event.detail.taskId));
 for(const schedule of data.schedules??[])if(schedule.lastTaskId)scheduleIds.add(String(schedule.lastTaskId));
 const targetName=(id:string)=>(data.servers??[]).find(row=>row.id===id)?.name??(data.schedules??[]).find(row=>row.id===id)?.name??id;
 const result:LogEntry[]=[];
 const append=(entry:Omit<LogEntry,'searchText'>)=>result.push({...entry,searchText:JSON.stringify(entry).toLowerCase()});
 for(const row of audits){
  const event=String(row.action??row.name??'audit'),resource=String(row.resource??''),taskId=String(row.detail?.taskId??'');
  const category:LogCategory=event.startsWith('schedule.')||row.actor==='scheduler'||resource.startsWith('schedules/')?'schedule':securityEvent.test(event)||/^(members|tokens)\//.test(resource)?'security':'system';
  const detail=logFields(row.detail??{}),status=String(detail.status??row.result??'已记录');
  const message=`${messages[event]??event} · ${status}`;
  append({id:`audit:${row.id}`,recordId:row.id,collection:'audit',category,at:String(row.created??''),level:eventLevel(row),source:category==='security'?'安全审计':category==='schedule'?'调度器':'主控',event,message,target:targetName(resource),taskId,fields:{id:row.id,event,created:row.created,actor:row.actor,target:resource,result:row.result,detail}});
 }
 for(const row of tasks){
  const event=String(row.type??row.name??'task'),id=String(row.id),target=String(row.serverId??row.target??'');
  const category:LogCategory=scheduleIds.has(id)?'schedule':target?'agent':'system';
  const fields={id,event,created:row.created,updated:row.updated,target,status:row.status,duration:row.duration,error:row.error??''};
  append({id:`tasks:${id}`,recordId:id,collection:'tasks',category,at:String(row.updated??row.created??''),level:eventLevel(row),source:category==='schedule'?'调度器':target?String(targetName(target)):'主控',event,message:String(row.error||row.status||'状态未知'),target:targetName(target),taskId:id,fields});
 }
 return result.sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0)||a.id.localeCompare(b.id));
}
export function filterLogs(entries:LogEntry[],filters:{category:LogCategory|'all';level:string;source:string;query:string;taskId?:string}){
 const terms=filters.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
 return entries.filter(row=>(filters.category==='all'||row.category===filters.category)&&(!filters.level||row.level===filters.level)&&(!filters.source||row.source===filters.source)&&(!filters.taskId||row.taskId===filters.taskId)&&terms.every(term=>row.searchText.includes(term)));
}
