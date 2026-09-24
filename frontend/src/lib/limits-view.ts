export type LimitRule = {
 id:string; kind:'behavior'|'speed'|'quota'; enabled:boolean; type?:string;
 thresholdMbps?:number; durationSeconds?:number; windowSeconds?:number; hits?:number;
 limitMbps?:number; penaltySeconds?:number; priority?:number;
 resourceId?:string; resourceName?:string; quotaMode?:string; quotaGB?:number;
};
export type LimitGroup = {
 id:string; scope:'global'|'plan'|'member'|'subscription'; source:string; sourceId:string;
 name:string; mode:string; enabled:boolean; maxGapSeconds?:number; rules:LimitRule[]; error?:string;
};
export type LimitTrigger = {
 id:string; userId:string; userName:string; serverId?:string; serverName?:string;
 ruleId:string; type:string; reason:string; source:string; sourceName:string;
 sampleMbps?:number; limitMbps?:number; at:string; until?:string;
 status:'active'|'released'|'expired'|'unknown'; releasedAt?:string; releaseReason?:string; rule?:LimitRule;
};
export const scopeLabels = {global:'全局',plan:'套餐',member:'用户',subscription:'用户套餐'};
export const statusLabels = {active:'处罚期内',released:'已解除',expired:'已到期',unknown:'状态待确认'};
const numeric = (value:unknown):number|null => {
 if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+(\.\d+)?$/.test(value.trim())))return null;
 const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;
};
const numberLabel=(value:number)=>value.toLocaleString('zh-CN',{maximumSignificantDigits:6});
export function rateLabel(value:unknown,unlimited=false){const n=numeric(value);return n===null?'未知':n===0&&unlimited?'不限':`${numberLabel(n)} Mbps`;}
export function durationLabel(value:unknown){
 const n=numeric(value);if(!n)return '未设置';
 for(const [unit,label] of [[86400,'天'],[3600,'小时'],[60,'分钟']] as const)if(n%unit===0)return `${numberLabel(n/unit)} ${label}`;
 return `${numberLabel(n)} 秒`;
}
export function timeLabel(value:unknown){if(typeof value!=='string'||!value)return '—';const d=new Date(value);return Number.isFinite(d.getTime())&&d.getTime()>0?d.toLocaleString('zh-CN',{hour12:false}):'—';}
const presetNames:Record<string,string>={'balanced-long':'均衡 · 持续大流量','balanced-high':'均衡 · 持续高速','relaxed-long':'宽松 · 持续大流量','relaxed-high':'宽松 · 持续高速','strict-long':'严格 · 持续大流量','strict-high':'严格 · 持续高速'};
export function ruleTitle(rule:Pick<LimitRule,'id'|'kind'>){if(rule.kind==='speed')return '固定下载上限';if(rule.kind==='quota')return '流量用尽策略';return presetNames[rule.id.split('/').at(-1)??'']||rule.id||'行为限速';}
export function ruleCondition(rule:LimitRule){
 if(rule.kind==='speed')return rule.resourceId?`仅限 ${rule.resourceName||rule.resourceId}`:'使用此来源配置时';
 if(rule.kind==='quota')return numeric(rule.quotaGB)?`套餐流量达到 ${numberLabel(Number(rule.quotaGB))} GiB`:'套餐流量额度用尽';
 if(rule.type==='sustained')return `下载 ≥ ${rateLabel(rule.thresholdMbps)}，持续 ${durationLabel(rule.durationSeconds)}`;
 if(rule.type==='burst')return `${durationLabel(rule.windowSeconds)}内，下载 ≥ ${rateLabel(rule.thresholdMbps)} 的采样累计 ${rule.hits??'未知'} 次`;
 return '触发条件未记录';
}
export function ruleResult(rule:LimitRule){return rule.kind==='quota'&&(rule.quotaMode!=='throttle'||!numeric(rule.limitMbps))?'停用该套餐凭据':rateLabel(rule.limitMbps,true);}
export function rulePeriod(rule:LimitRule){return rule.kind==='behavior'?durationLabel(rule.penaltySeconds):rule.kind==='quota'?'额度恢复后解除':'持续生效';}
export function triggerCondition(row:LimitTrigger){
 if(row.type==='quota_triggered')return '套餐流量额度用尽';
 if(row.rule)return ruleCondition({...row.rule,kind:'behavior'});
 return `${row.reason==='sustained'?'持续超速':row.reason==='burst'?'多次超速':'行为限速'} · 历史记录未保存阈值`;
}
export function triggerResult(row:LimitTrigger){return row.type==='quota_triggered'&&numeric(row.limitMbps)===0?'停用该套餐凭据':rateLabel(row.limitMbps,true);}
export function releaseLabel(reason?:string){return ({penalty_expired:'处罚到期',rule_disabled:'规则已停用',configuration_changed:'配置已调整',quota_available:'额度已恢复'} as Record<string,string>)[reason??'']||'处罚已结束';}
export function matchesLimitSearch(search:string,...values:unknown[]){return values.join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());}
